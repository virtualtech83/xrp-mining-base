from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import secrets
import string
import bcrypt

# ------------------ ENV SAFETY ------------------
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

_raw_jwt_secret = os.environ.get("JWT_SECRET")
if not _raw_jwt_secret or not isinstance(_raw_jwt_secret, str):
    JWT_SECRET = "xrp-mining-dev-secret-fallback"
else:
    JWT_SECRET = _raw_jwt_secret.strip()

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

# ------------------ HELPERS ------------------
def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_referral_code() -> str:
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one(
            {"id": payload["user_id"]},
            {"_id": 0},
        )
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

    user_doc = {
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "xrp_balance": 0.0,
        "total_mined": 0.0,
        "referral_code": generate_referral_code(),
        "referred_by": data.referral_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)

    return {
        "token": create_token(user_id),
        "user": {
            "id": user_id,
            "email": data.email,
            "xrp_balance": 0.0,
        },
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
        },
    }

# ------------------ USER PROFILE (THIS FIXES THE 404) ------------------
@api_router.get("/user/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return current_user

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
