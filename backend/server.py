from fastapi import FastAPI, Depends, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import logging

# ---------------- APP ----------------
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- LOGGING ----------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# ---------------- DB ----------------
MONGO_URI = os.environ.get("MONGO_URI")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI environment variable not set")

client = AsyncIOMotorClient(MONGO_URI)

# ⚠️ Explicit DB name (IMPORTANT)
db = client["xrp_mining_base"]

# ---------------- AUTH ----------------
# ⚠️ MUST already exist in your project
from auth import get_current_user  # adjust path if needed

# ---------------- MINING CONFIG ----------------
MINING_RATE_PER_SECOND = 0.0001

# ---------------- MINING START ----------------
@api_router.post("/mining/start")
async def start_mining(current_user: dict = Depends(get_current_user)):
    if current_user.get("mining_active"):
        raise HTTPException(status_code=400, detail="Mining already started")

    now = datetime.now(timezone.utc)

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "mining_active": True,
            "mining_started_at": now.isoformat()
        }}
    )

    return {"success": True}

# ---------------- MINING STOP ----------------
@api_router.post("/mining/stop")
async def stop_mining(current_user: dict = Depends(get_current_user)):
    if not current_user.get("mining_active"):
        raise HTTPException(status_code=400, detail="Mining not active")

    start_time = datetime.fromisoformat(current_user["mining_started_at"])
    now = datetime.now(timezone.utc)

    seconds = (now - start_time).total_seconds()
    mined = round(seconds * MINING_RATE_PER_SECOND, 6)

    await db.mining_history.insert_one({
        "user_id": current_user["id"],
        "amount": mined,
        "started_at": start_time.isoformat(),
        "stopped_at": now.isoformat()
    })

    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "xrp_balance": mined,
                "total_mined": mined
            },
            "$set": {"mining_active": False},
            "$unset": {"mining_started_at": ""}
        }
    )

    return {"success": True, "mined": mined}

# ---------------- MINING ACTIVE ----------------
@api_router.get("/mining/active")
async def mining_active(current_user: dict = Depends(get_current_user)):
    if not current_user.get("mining_active"):
        return {"active": False}

    start_time = datetime.fromisoformat(current_user["mining_started_at"])
    seconds = (datetime.now(timezone.utc) - start_time).total_seconds()

    return {
        "active": True,
        "current_amount": round(seconds * MINING_RATE_PER_SECOND, 6)
    }

# ---------------- MINING HISTORY ----------------
@api_router.get("/mining/history")
async def mining_history(current_user: dict = Depends(get_current_user)):
    return await db.mining_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("stopped_at", -1).to_list(100)

# ---------------- DAILY REWARD ----------------
@api_router.post("/rewards/daily")
async def claim_daily_reward(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    last = current_user.get("last_daily_reward")

    if last:
        if now - datetime.fromisoformat(last) < timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Already claimed")

    reward = 5.0

    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "xrp_balance": reward,
                "total_mined": reward
            },
            "$set": {"last_daily_reward": now.isoformat()}
        }
    )

    return {"success": True, "reward": reward}

@api_router.get("/rewards/daily/status")
async def daily_status(current_user: dict = Depends(get_current_user)):
    last = current_user.get("last_daily_reward")
    if not last:
        return {"can_claim": True}

    can = datetime.now(timezone.utc) - datetime.fromisoformat(last) >= timedelta(hours=24)
    return {"can_claim": can}

# ---------------- MIDDLEWARE ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- SHUTDOWN ----------------
@app.on_event("shutdown")
async def shutdown():
    client.close()
