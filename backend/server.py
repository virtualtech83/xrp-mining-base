from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import secrets
import string
import bcrypt

# ------------------ ENV SAFETY ------------------
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET", "xrp-mining-secret-key-change-in-production")

if not MONGO_URL:
    raise RuntimeError("MONGO_URL is missing")
if not DB_NAME:
    raise RuntimeError("DB_NAME is missing")

MONGO_URL = MONGO_URL.strip()
DB_NAME = DB_NAME.strip()

# ------------------ DATABASE ------------------
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

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    xrp_balance: float
    referral_code: str
    total_mined: float
    created_at: str

class MiningSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    start_time: str
    end_time: Optional[str]
    duration_minutes: Optional[float]
    xrp_earned: float
    status: str

class MiningStop(BaseModel):
    session_id: str
    duration_minutes: float

class WithdrawalRequest(BaseModel):
    amount: float
    wallet_address: str

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
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
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
    referral_code = generate_referral_code()

    user_doc = {
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "xrp_balance": 0.0,
        "total_mined": 0.0,
        "referral_code": referral_code,
        "referred_by": data.referral_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)

    # Reward referrer if referral_code is valid
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code})
        if referrer:
            reward_amount = 10.0  # Example referral bonus
            await db.users.update_one({"id": referrer["id"]}, {"$inc": {"xrp_balance": reward_amount}})

    return {
        "token": create_token(user_id),
        "user": {
            "id": user_id,
            "email": data.email,
            "xrp_balance": 0.0,
            "referral_code": referral_code
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
            "xrp_balance": user["xrp_balance"],
            "referral_code": user["referral_code"]
        }
    }

# ------------------ USER ------------------
@api_router.get("/user/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return UserProfile(**current_user)

# ------------------ MINING ------------------
@api_router.post("/mining/start", response_model=MiningSession)
async def start_mining(current_user: dict = Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    session_doc = {
        "id": session_id,
        "user_id": current_user["id"],
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": None,
        "duration_minutes": None,
        "xrp_earned": 0.0,
        "status": "active"
    }
    await db.mining_sessions.insert_one(session_doc)
    return MiningSession(**session_doc)

@api_router.post("/mining/stop", response_model=MiningSession)
async def stop_mining(data: MiningStop, current_user: dict = Depends(get_current_user)):
    session = await db.mining_sessions.find_one({"id": data.session_id, "user_id": current_user["id"], "status": "active"})
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    xrp_earned = data.duration_minutes * 0.1
    await db.mining_sessions.update_one(
        {"id": data.session_id},
        {"$set": {
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration_minutes": data.duration_minutes,
            "xrp_earned": xrp_earned,
            "status": "completed"
        }}
    )
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"xrp_balance": xrp_earned, "total_mined": xrp_earned}})
    updated_session = await db.mining_sessions.find_one({"id": data.session_id}, {"_id": 0})
    return MiningSession(**updated_session)

# ------------------ REFERRAL ------------------
@api_router.get("/referrals")
async def get_referrals(current_user: dict = Depends(get_current_user)):
    referrals = await db.users.find({"referred_by": current_user["referral_code"]}).to_list(100)
    return [{"email": r["email"], "id": r["id"], "xrp_balance": r["xrp_balance"]} for r in referrals]

# ------------------ WITHDRAWAL ------------------
@api_router.post("/withdraw")
async def request_withdrawal(data: WithdrawalRequest, current_user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid withdrawal amount")
    if data.amount > current_user["xrp_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    withdrawal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "amount": data.amount,
        "wallet_address": data.wallet_address,
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat()
    }

    await db.withdrawals.insert_one(withdrawal_doc)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"xrp_balance": -data.amount}})

    return {"detail": "Withdrawal requested successfully", "withdrawal_id": withdrawal_doc["id"]}

# ------------------ ROUTER & CORS ------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://xrp-mining-base.vercel.app"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ LOGGING ------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
