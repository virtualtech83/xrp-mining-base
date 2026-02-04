from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import secrets
import string
import bcrypt

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

class MiningSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    start_time: str
    status: str
    xrp_earned: float

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

    return {
        "token": create_token(user_id),
        "user": {"id": user_id, "email": data.email, "xrp_balance": 0.0}
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "token": create_token(user["id"]),
        "user": {"id": user["id"], "email": user["email"], "xrp_balance": user["xrp_balance"]}
    }

# ------------------ USER ------------------
@api_router.get("/user/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return current_user

# ------------------ MINING ------------------
@api_router.post("/mining/start")
async def start_mining(current_user: dict = Depends(get_current_user)):
    active = await db.mining_sessions.find_one({
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

    await db.mining_sessions.insert_one(session)

    return {
        "success": True,
        "message": "Mining started",
        "session": session
    }

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
