# ------------------ IMPORTS ------------------
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
import uuid, jwt, bcrypt, os, secrets, string

# ------------------ ENV ------------------
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET", "xrp-mining-secret-key")

if not MONGO_URL or not DB_NAME:
    raise RuntimeError("Missing MongoDB environment variables")

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
    referral_code: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# ------------------ HELPERS ------------------
def create_token(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]})
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
        raise HTTPException(status_code=400, detail="Email already exists")
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "xrp_balance": 0.0,
        "total_mined": 0.0,
        "referral_code": ''.join(secrets.choice(string.ascii_uppercase+string.digits) for _ in range(8)),
        "referred_by": data.referral_code,
        "last_daily_reward": None
    })
    return {"token": create_token(user_id), "user": {"id": user_id, "email": data.email, "xrp_balance": 0.0}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user["id"]), "user": {"id": user["id"], "email": user["email"], "xrp_balance": user["xrp_balance"]}}

# ------------------ MINING ------------------
@api_router.post("/mining/start")
async def start_mining(current_user: dict = Depends(get_current_user)):
    active = await db.mining.find_one({"user_id": current_user["id"], "status": "active"})
    if active:
        raise HTTPException(status_code=400, detail="Mining already started")
    session = {"id": str(uuid.uuid4()), "user_id": current_user["id"], "start_time": datetime.now(timezone.utc).isoformat(), "status": "active", "xrp_earned": 0.0}
    await db.mining.insert_one(session)
    return {"success": True, "session_id": session["id"]}

@api_router.post("/mining/stop")
async def stop_mining(current_user: dict = Depends(get_current_user)):
    session = await db.mining.find_one({"user_id": current_user["id"], "status": "active"})
    if not session:
        raise HTTPException(status_code=400, detail="No active mining session")
    start = datetime.fromisoformat(session["start_time"])
    minutes = (datetime.now(timezone.utc) - start).total_seconds()/60
    earned = round(minutes*0.02, 4)
    await db.mining.update_one({"id": session["id"]}, {"$set":{"status":"completed","end_time":datetime.now(timezone.utc).isoformat(),"duration_minutes":minutes,"xrp_earned":earned}})
    await db.users.update_one({"id": current_user["id"]}, {"$inc":{"xrp_balance":earned,"total_mined":earned}})
    return {"success": True, "earned": earned}

@api_router.get("/mining/active")
async def active_mining(current_user: dict = Depends(get_current_user)):
    return await db.mining.find_one({"user_id": current_user["id"], "status":"active"}, {"_id":0})

@api_router.get("/mining/history")
async def mining_history(current_user: dict = Depends(get_current_user)):
    return await db.mining.find({"user_id":current_user["id"], "status":"completed"}, {"_id":0}).to_list(100)

# ------------------ DAILY REWARD ------------------
@api_router.post("/rewards/daily")
async def claim_daily(current_user: dict = Depends(get_current_user)):
    last = current_user.get("last_daily_reward")
    now = datetime.now(timezone.utc)
    if last and (now - datetime.fromisoformat(last)) < timedelta(hours=24):
        raise HTTPException(status_code=400, detail="Daily reward already claimed")
    await db.users.update_one({"id":current_user["id"]},{"$inc":{"xrp_balance":5,"total_mined":5},"$set":{"last_daily_reward":now.isoformat()}})
    return {"success": True, "reward": 5}

@api_router.get("/rewards/daily/status")
async def daily_status(current_user: dict = Depends(get_current_user)):
    last = current_user.get("last_daily_reward")
    now = datetime.now(timezone.utc)
    if not last or (now - datetime.fromisoformat(last)) >= timedelta(hours=24):
        return {"can_claim": True}
    return {"can_claim": False}

# ------------------ FINAL SETUP ------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
