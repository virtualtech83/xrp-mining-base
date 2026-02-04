from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import logging

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- DB ----------------
MONGO_URI = os.environ.get("MONGO_URI")
client = AsyncIOMotorClient(MONGO_URI)
db = client.get_default_database()

# ---------------- MINING CONFIG ----------------
MINING_RATE_PER_SECOND = 0.0001  # XRP per second

# ---------------- MINING START ----------------
@api_router.post("/mining/start")
async def start_mining(current_user: dict = Depends(get_current_user)):
    if current_user.get("mining_active"):
        raise HTTPException(status_code=400, detail="Mining already started")

    now = datetime.now(timezone.utc)

    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "mining_active": True,
                "mining_started_at": now.isoformat(),
                "current_mining_amount": 0.0
            }
        }
    )

    return {"success": True, "started_at": now.isoformat()}

# ---------------- MINING STOP ----------------
@api_router.post("/mining/stop")
async def stop_mining(current_user: dict = Depends(get_current_user)):
    if not current_user.get("mining_active"):
        raise HTTPException(status_code=400, detail="Mining not active")

    start_time = datetime.fromisoformat(current_user["mining_started_at"])
    now = datetime.now(timezone.utc)

    seconds = (now - start_time).total_seconds()
    mined_amount = round(seconds * MINING_RATE_PER_SECOND, 6)

    # Save history
    await db.mining_history.insert_one({
        "user_id": current_user["id"],
        "amount": mined_amount,
        "started_at": start_time.isoformat(),
        "stopped_at": now.isoformat()
    })

    # Update user balances
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "xrp_balance": mined_amount,
                "total_mined": mined_amount
            },
            "$set": {
                "mining_active": False,
                "current_mining_amount": 0.0
            },
            "$unset": {
                "mining_started_at": ""
            }
        }
    )

    return {
        "success": True,
        "mined": mined_amount,
        "stopped_at": now.isoformat()
    }

# ---------------- MINING ACTIVE STATUS ----------------
@api_router.get("/mining/active")
async def mining_active(current_user: dict = Depends(get_current_user)):
    if not current_user.get("mining_active"):
        return {"active": False}

    start_time = datetime.fromisoformat(current_user["mining_started_at"])
    now = datetime.now(timezone.utc)
    seconds = (now - start_time).total_seconds()

    amount = round(seconds * MINING_RATE_PER_SECOND, 6)

    return {
        "active": True,
        "current_amount": amount,
        "started_at": start_time.isoformat()
    }

# ---------------- MINING HISTORY ----------------
@api_router.get("/mining/history")
async def mining_history(current_user: dict = Depends(get_current_user)):
    history = await db.mining_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("stopped_at", -1).to_list(100)

    return history

# ---------------- DAILY REWARD ----------------
@api_router.post("/rewards/daily")
async def claim_daily_reward(current_user: dict = Depends(get_current_user)):
    last_claim = current_user.get("last_daily_reward")
    now = datetime.now(timezone.utc)

    if last_claim:
        last_claim_dt = datetime.fromisoformat(last_claim)
        if now - last_claim_dt < timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Daily reward already claimed")

    reward = 5.0

    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "xrp_balance": reward,
                "total_mined": reward
            },
            "$set": {
                "last_daily_reward": now.isoformat()
            }
        }
    )

    return {
        "success": True,
        "reward": reward,
        "next_claim": (now + timedelta(hours=24)).isoformat()
    }

@api_router.get("/rewards/daily/status")
async def daily_reward_status(current_user: dict = Depends(get_current_user)):
    last_claim = current_user.get("last_daily_reward")
    now = datetime.now(timezone.utc)

    if not last_claim:
        return {"can_claim": True}

    last_claim_dt = datetime.fromisoformat(last_claim)
    can_claim = now - last_claim_dt >= timedelta(hours=24)

    return {
        "can_claim": can_claim,
        "next_claim": None if can_claim else (last_claim_dt + timedelta(hours=24)).isoformat()
    }

# ---------------- APP CONFIG ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown():
    client.close()
