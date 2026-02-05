from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os, uuid, secrets, string, bcrypt, jwt, logging
from datetime import datetime, timezone, timedelta

# ------------------ ENV ------------------
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET", "xrp-mining-secret-key-change-in-production")

if not MONGO_URL or not DB_NAME:
    raise RuntimeError("Missing environment variables")

MONGO_URL = MONGO_URL.strip()
DB_NAME = DB_NAME.strip()

# ------------------ DB ------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ------------------ APP ------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
JWT_ALGORITHM = "HS256"

# ------------------ MODELS ------------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# ------------------ HELPERS ------------------
def create_token(user_id: str) -> str:
    return jwt.encode(
        {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )

def generate_referral_code() -> str:
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])  # convert ObjectId to str
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ------------------ AUTH ------------------
@api_router.post("/auth/register")
async def register(data: UserRegister):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "xrp_balance": 0.0,
        "total_mined": 0.0,
        "referral_code": generate_referral_code(),
        "referred_by": data.referral_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"token": create_token(user_id), "user": {"id": user_id, "email": data.email, "xrp_balance": 0.0}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"token": create_token(user["id"]), "user": {"id": user["id"], "email": user["email"], "xrp_balance": user["xrp_balance"]}}

# ------------------ USER ------------------
@api_router.get("/user/profile")
async def profile(current_user: dict = Depends(get_current_user)):
    return current_user

# ------------------ MINING ------------------
def serialize_session(session: dict) -> dict:
    session = session.copy()
    if "_id" in session:
        session["_id"] = str(session["_id"])
    return session

@api_router.get("/mining/active")
async def mining_active(current_user: dict = Depends(get_current_user)):
    session = await db.mining_sessions.find_one(
        {"user_id": current_user["id"], "status": "active"}
    )
    return serialize_session(session) if session else {"active": False}

@api_router.post("/mining/start")
async def mining_start(current_user: dict = Depends(get_current_user)):
    existing = await db.mining_sessions.find_one(
        {"user_id": current_user["id"], "status": "active"}
    )
    if existing:
        return {"success": True, "session": serialize_session(existing)}

    session = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "start_time": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "xrp_earned": 0.0
    }
    await db.mining_sessions.insert_one(session)
    return {"success": True, "session": serialize_session(session)}

@api_router.post("/mining/stop")
async def mining_stop(current_user: dict = Depends(get_current_user)):
    session = await db.mining_sessions.find_one(
        {"user_id": current_user["id"], "status": "active"}
    )
    if not session:
        raise HTTPException(status_code=400, detail="No active mining session")

    start = datetime.fromisoformat(session["start_time"])
    now = datetime.now(timezone.utc)
    minutes = max((now - start).total_seconds() / 60, 1)

    # Mining rate logic
    base_rate = 0.01
    bonus = min(minutes / 60, 3)
    earned = round(minutes * (base_rate + bonus * 0.005), 6)

    await db.mining_sessions.update_one(
        {"id": session["id"]},
        {"$set": {
            "status": "completed",
            "end_time": now.isoformat(),
            "duration_minutes": minutes,
            "xrp_earned": earned
        }}
    )

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"xrp_balance": earned, "total_mined": earned}}
    )

    session["status"] = "completed"
    session["end_time"] = now.isoformat()
    session["duration_minutes"] = minutes
    session["xrp_earned"] = earned

    return {"success": True, "earned": earned, "session": serialize_session(session)}

@api_router.get("/mining/history")
async def mining_history(current_user: dict = Depends(get_current_user)):
    sessions = await db.mining_sessions.find(
        {"user_id": current_user["id"], "status": "completed"}
    ).sort("start_time", -1).to_list(100)
    return [serialize_session(s) for s in sessions]

# ------------------ DAILY REWARD ------------------
@api_router.post("/rewards/daily")
async def daily_reward(current_user: dict = Depends(get_current_user)):
    last = current_user.get("last_daily_reward")
    now = datetime.now(timezone.utc)

    if last and now - datetime.fromisoformat(last) < timedelta(hours=24):
        raise HTTPException(status_code=400, detail="Daily reward already claimed")

    reward = 5.0
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"xrp_balance": reward, "total_mined": reward},
         "$set": {"last_daily_reward": now.isoformat()}}
    )

    return {"success": True, "reward": reward}

@api_router.get("/rewards/daily/status")
async def daily_status(current_user: dict = Depends(get_current_user)):
    last = current_user.get("last_daily_reward")
    if not last:
        return {"can_claim": True}

    next_time = datetime.fromisoformat(last) + timedelta(hours=24)
    return {"can_claim": datetime.now(timezone.utc) >= next_time, "next_claim_time": next_time.isoformat()}

# ------------------ LEADERBOARD ------------------
@api_router.get("/leaderboard")
async def leaderboard():
    users = await db.users.find({}, {"_id": 0, "email": 1, "total_mined": 1}).sort("total_mined", -1).limit(100).to_list(100)
    return [{"rank": i + 1, **u} for i, u in enumerate(users)]

# ------------------ FINAL SETUP ------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://xrp-mining-base.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown():
    client.close()
