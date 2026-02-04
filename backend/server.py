from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import jwt
import os
import secrets
import string
import bcrypt
import logging

# ------------------ ENV ------------------
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET", "xrp-mining-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

if not MONGO_URL or not DB_NAME:
    raise RuntimeError("Missing MongoDB environment variables")

MONGO_URL = MONGO_URL.strip()
DB_NAME = DB_NAME.strip()

# ------------------ DATABASE ------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ------------------ APP & ROUTER ------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ------------------ MODELS ------------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class MiningStop(BaseModel):
    session_id: str
    duration_minutes: float

# ------------------ HELPERS ------------------
def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_referral_code() -> str:
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ------------------ AUTH ROUTES ------------------
@api_router.post("/auth/register")
async def register(data: UserRegister):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "xrp_balance": 0.0,
        "total_mined": 0.0,
        "referral_code": generate_referral_code(),
        "referred_by": data.referral_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_daily_reward": None
    }

    await db.users.insert_one(user)

    return {
        "token": create_token(user_id),
        "user": {
            "id": user_id,
            "email": data.email,
            "xrp_balance": 0.0
        }
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "token": create_token(user["id"]),
        "user": {
            "id": user["id"],
            "email": user["email"],
            "xrp_balance": user["xrp_balance"]
        }
    }

# ------------------ USER PROFILE ------------------
@api_router.get("/user/profile")
async def profile(current_user: dict = Depends(get_current_user)):
    current_user.pop("_id", None)
    current_user.pop("password_hash", None)
    return current_user

# ------------------ MINING ------------------
@api_router.post("/mining/start")
async def start_mining(current_user: dict = Depends(get_current_user)):
    active = await db.mining.find_one({
        "user_id": current_user["id"],
        "status": "active"
    })

    if active:
        raise HTTPException(status_code=400, detail="Mining already started")

    session = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "start_time": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "xrp_earned": 0.0
    }

    await db.mining.insert_one(session)
    return {"success": True, "session_id": session["id"]}

@api_router.post("/mining/stop")
async def stop_mining(current_user: dict = Depends(get_current_user)):
    session = await db.mining.find_one({
        "user_id": current_user["id"],
        "status": "active"
    })

    if not session:
        raise HTTPException(status_code=400, detail="No active mining session")

    start = datetime.fromisoformat(session["start_time"])
    now = datetime.now(timezone.utc)
    minutes = (now - start).total_seconds() / 60
    earned = round(minutes * 0.02, 4)

    await db.mining.update_one(
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
        {"$inc": {
            "xrp_balance": earned,
            "total_mined": earned
        }}
    )

    return {"success": True, "earned": earned}

@api_router.get("/mining/active")
async def active_mining(current_user: dict = Depends(get_current_user)):
    session = await db.mining.find_one({
        "user_id": current_user["id"],
        "status": "active"
    }, {"_id": 0})
    return session

@api_router.get("/mining/history")
async def mining_history(current_user: dict = Depends(get_current_user)):
    return await db.mining.find(
        {"user_id": current_user["id"], "status": "completed"},
        {"_id": 0}
    ).to_list(100)

# ------------------ DAILY REWARD ------------------
@api_router.post("/rewards/daily")
async def claim_daily_reward(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    last = current_user.get("last_daily_reward")

    if last:
        last_dt = datetime.fromisoformat(last)
        if now - last_dt < timedelta(hours=24):
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

    last_dt = datetime.fromisoformat(last)
    if datetime.now(timezone.utc) - last_dt >= timedelta(hours=24):
        return {"can_claim": True}

    return {"can_claim": False}

# ------------------ REGISTER ROUTER ------------------
app.include_router(api_router)

# ------------------ CORS ------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://xrp-mining-base.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ LOGGING ------------------
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown():
    client.close()
