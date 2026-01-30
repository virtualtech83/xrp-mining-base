from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'xrp-mining-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Models
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
    end_time: Optional[str] = None
    duration_minutes: Optional[float] = None
    xrp_earned: float
    status: str

class MiningStart(BaseModel):
    pass

class MiningStop(BaseModel):
    session_id: str
    duration_minutes: float

class WithdrawalRequest(BaseModel):
    amount: float

class WithdrawalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    amount: float
    status: str
    created_at: str

class ReferralStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    referral_code: str
    total_referrals: int
    total_rewards: float
    referred_users: List[dict]

class DailyRewardResponse(BaseModel):
    success: bool
    reward_amount: float
    new_balance: float
    next_claim_time: str

class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: str
    total_mined: float
    rank: int

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_referral_code() -> str:
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({'email': data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    referral_code = generate_referral_code()
    
    user_doc = {
        'id': user_id,
        'email': data.email,
        'password_hash': hash_password(data.password),
        'xrp_balance': 0.0,
        'total_mined': 0.0,
        'referral_code': referral_code,
        'referred_by': data.referral_code,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'last_daily_reward': None
    }
    
    await db.users.insert_one(user_doc)
    
    # If referred by someone, give bonus
    if data.referral_code:
        referrer = await db.users.find_one({'referral_code': data.referral_code})
        if referrer:
            bonus = 10.0
            await db.users.update_one(
                {'id': referrer['id']},
                {'$inc': {'xrp_balance': bonus, 'total_mined': bonus}}
            )
            
            referral_doc = {
                'id': str(uuid.uuid4()),
                'referrer_id': referrer['id'],
                'referred_user_id': user_id,
                'reward_earned': bonus,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            await db.referrals.insert_one(referral_doc)
    
    token = create_token(user_id)
    return {'token': token, 'user': {'id': user_id, 'email': data.email, 'xrp_balance': 0.0}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({'email': data.email})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'])
    return {'token': token, 'user': {'id': user['id'], 'email': user['email'], 'xrp_balance': user['xrp_balance']}}

# User endpoints
@api_router.get("/user/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return UserProfile(**current_user)

# Mining endpoints
@api_router.post("/mining/start", response_model=MiningSession)
async def start_mining(current_user: dict = Depends(get_current_user)):
    active_session = await db.mining_sessions.find_one({
        'user_id': current_user['id'],
        'status': 'active'
    })
    
    if active_session:
        raise HTTPException(status_code=400, detail="Mining session already active")
    
    session_id = str(uuid.uuid4())
    session_doc = {
        'id': session_id,
        'user_id': current_user['id'],
        'start_time': datetime.now(timezone.utc).isoformat(),
        'end_time': None,
        'duration_minutes': None,
        'xrp_earned': 0.0,
        'status': 'active'
    }
    
    await db.mining_sessions.insert_one(session_doc)
    return MiningSession(**session_doc)

@api_router.post("/mining/stop", response_model=MiningSession)
async def stop_mining(data: MiningStop, current_user: dict = Depends(get_current_user)):
    session = await db.mining_sessions.find_one({
        'id': data.session_id,
        'user_id': current_user['id'],
        'status': 'active'
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    
    duration = data.duration_minutes
    xrp_earned = duration * 0.1 * (1 + (duration / 60))
    
    end_time = datetime.now(timezone.utc).isoformat()
    
    await db.mining_sessions.update_one(
        {'id': data.session_id},
        {'$set': {
            'end_time': end_time,
            'duration_minutes': duration,
            'xrp_earned': xrp_earned,
            'status': 'completed'
        }}
    )
    
    await db.users.update_one(
        {'id': current_user['id']},
        {'$inc': {'xrp_balance': xrp_earned, 'total_mined': xrp_earned}}
    )
    
    updated_session = await db.mining_sessions.find_one({'id': data.session_id}, {'_id': 0})
    return MiningSession(**updated_session)

@api_router.get("/mining/history", response_model=List[MiningSession])
async def get_mining_history(current_user: dict = Depends(get_current_user)):
    sessions = await db.mining_sessions.find(
        {'user_id': current_user['id'], 'status': 'completed'},
        {'_id': 0}
    ).sort('start_time', -1).limit(50).to_list(50)
    
    return [MiningSession(**s) for s in sessions]

@api_router.get("/mining/active")
async def get_active_session(current_user: dict = Depends(get_current_user)):
    session = await db.mining_sessions.find_one({
        'user_id': current_user['id'],
        'status': 'active'
    }, {'_id': 0})
    
    if not session:
        return None
    
    return MiningSession(**session)

# Withdrawal endpoints
@api_router.post("/withdrawal/request", response_model=WithdrawalResponse)
async def request_withdrawal(data: WithdrawalRequest, current_user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    if current_user['xrp_balance'] < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    withdrawal_id = str(uuid.uuid4())
    withdrawal_doc = {
        'id': withdrawal_id,
        'user_id': current_user['id'],
        'amount': data.amount,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.withdrawals.insert_one(withdrawal_doc)
    
    return WithdrawalResponse(**withdrawal_doc)

@api_router.get("/withdrawal/history")
async def get_withdrawal_history(current_user: dict = Depends(get_current_user)):
    withdrawals = await db.withdrawals.find(
        {'user_id': current_user['id']},
        {'_id': 0}
    ).sort('created_at', -1).limit(20).to_list(20)
    
    return withdrawals

# Referral endpoints
@api_router.get("/referral/stats", response_model=ReferralStats)
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    referrals = await db.referrals.find(
        {'referrer_id': current_user['id']},
        {'_id': 0}
    ).to_list(1000)
    
    referred_users = []
    for ref in referrals:
        user = await db.users.find_one({'id': ref['referred_user_id']}, {'_id': 0})
        if user:
            referred_users.append({
                'email': user['email'],
                'joined_at': user['created_at'],
                'reward': ref['reward_earned']
            })
    
    total_rewards = sum(r['reward_earned'] for r in referrals)
    
    return ReferralStats(
        referral_code=current_user['referral_code'],
        total_referrals=len(referrals),
        total_rewards=total_rewards,
        referred_users=referred_users
    )

# Daily reward endpoints
@api_router.post("/rewards/daily", response_model=DailyRewardResponse)
async def claim_daily_reward(current_user: dict = Depends(get_current_user)):
    last_claim = current_user.get('last_daily_reward')
    now = datetime.now(timezone.utc)
    
    if last_claim:
        last_claim_dt = datetime.fromisoformat(last_claim)
        time_diff = now - last_claim_dt
        if time_diff < timedelta(hours=24):
            next_claim = last_claim_dt + timedelta(hours=24)
            raise HTTPException(
                status_code=400,
                detail=f"Daily reward already claimed. Next claim at {next_claim.isoformat()}"
            )
    
    reward = 5.0
    
    await db.users.update_one(
        {'id': current_user['id']},
        {
            '$inc': {'xrp_balance': reward, 'total_mined': reward},
            '$set': {'last_daily_reward': now.isoformat()}
        }
    )
    
    new_balance = current_user['xrp_balance'] + reward
    next_claim = now + timedelta(hours=24)
    
    return DailyRewardResponse(
        success=True,
        reward_amount=reward,
        new_balance=new_balance,
        next_claim_time=next_claim.isoformat()
    )

@api_router.get("/rewards/daily/status")
async def check_daily_reward_status(current_user: dict = Depends(get_current_user)):
    last_claim = current_user.get('last_daily_reward')
    now = datetime.now(timezone.utc)
    
    if not last_claim:
        return {'can_claim': True, 'next_claim_time': None}
    
    last_claim_dt = datetime.fromisoformat(last_claim)
    time_diff = now - last_claim_dt
    
    if time_diff >= timedelta(hours=24):
        return {'can_claim': True, 'next_claim_time': None}
    
    next_claim = last_claim_dt + timedelta(hours=24)
    return {'can_claim': False, 'next_claim_time': next_claim.isoformat()}

# Leaderboard endpoints
@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    users = await db.users.find(
        {},
        {'_id': 0, 'email': 1, 'total_mined': 1}
    ).sort('total_mined', -1).limit(100).to_list(100)
    
    leaderboard = []
    for idx, user in enumerate(users, 1):
        leaderboard.append(LeaderboardEntry(
            email=user['email'],
            total_mined=user['total_mined'],
            rank=idx
        ))
    
    return leaderboard

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
