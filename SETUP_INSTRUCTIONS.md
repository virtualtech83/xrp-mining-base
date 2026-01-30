# XRP Mining Base - Setup Instructions

## 📦 Project Overview
A full-stack XRP mining simulation platform with modern crypto aesthetics, real-time mining mechanics, referral system, daily rewards, and leaderboard.

## 🛠️ Technology Stack
- **Frontend:** React 19, React Router, Tailwind CSS, Shadcn UI
- **Backend:** FastAPI, Python 3.11
- **Database:** MongoDB
- **Authentication:** JWT tokens with bcrypt

## 📋 Prerequisites
- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB (local or cloud instance)

## 🚀 Installation Steps

### 1. Extract the ZIP file
```bash
unzip xrp-mining-base.zip
cd xrp-mining-base
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Edit .env file and update:
MONGO_URL="your_mongodb_connection_string"
DB_NAME="xrp_mining_base"
CORS_ORIGINS="http://localhost:3000"
JWT_SECRET="your-secret-key-here"

# Start backend server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
yarn install

# Configure environment variables
# Edit .env file and update:
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000

# Start frontend development server
yarn start
```

The app will open at http://localhost:3000

## 🗄️ MongoDB Setup

### Option 1: Local MongoDB
1. Install MongoDB Community Edition from https://www.mongodb.com/try/download/community
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017`

### Option 2: MongoDB Atlas (Cloud)
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string and update backend/.env
4. Whitelist your IP address

## 🎯 Key Features

### ✅ User Features
- **Authentication:** Sign up / Login with email & password
- **Mining Center:** Click-to-start auto-mining with increasing rewards
- **Dashboard:** View balance, claim daily rewards (5 XRP/24h)
- **History:** Track all mining sessions
- **Referral System:** Earn 10 XRP per referral
- **Withdrawal:** Request withdrawals (simulated)
- **Leaderboard:** Top 100 miners ranked by total XRP mined

### 💎 Mining Mechanics
- Start mining with one click
- Auto-accumulation with real-time stats
- Increasing reward formula: `duration * 0.1 * (1 + duration/60)`
- Hash rate, session timer, and accumulated XRP display
- Visual rotating reactor when active

### 📱 Responsive Design
- Mobile-friendly with hamburger menu
- Desktop sidebar navigation
- Adapts to all screen sizes (375px to 1920px+)

## 🔐 Default Admin Setup (Optional)

To create an admin user, use the API:
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@xrpminingbase.com",
    "password": "admin123"
  }'
```

## 🎨 Design Customization

### Colors (in frontend/src/index.css)
```css
--primary: 217 91% 60%;  /* Electric Blue */
--accent: 48 96% 53%;    /* Gold */
--background: 0 0% 2%;   /* Dark */
```

### Fonts (in frontend/tailwind.config.js)
- **Headings:** Unbounded (Google Fonts)
- **Body:** Inter
- **Numbers/Code:** JetBrains Mono

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

### User
- `GET /api/user/profile` - Get user info

### Mining
- `POST /api/mining/start` - Start mining session
- `POST /api/mining/stop` - Stop mining & add to balance
- `GET /api/mining/history` - Get mining sessions
- `GET /api/mining/active` - Check active session

### Rewards
- `POST /api/rewards/daily` - Claim daily reward
- `GET /api/rewards/daily/status` - Check if can claim

### Referral
- `GET /api/referral/stats` - Get referral stats

### Withdrawal
- `POST /api/withdrawal/request` - Request withdrawal
- `GET /api/withdrawal/history` - Get withdrawal history

### Leaderboard
- `GET /api/leaderboard` - Get top miners

## 🐛 Troubleshooting

### Frontend not connecting to backend
- Check REACT_APP_BACKEND_URL in frontend/.env
- Ensure backend is running on port 8001
- Check CORS_ORIGINS in backend/.env includes http://localhost:3000

### MongoDB connection issues
- Verify MONGO_URL in backend/.env
- Check MongoDB service is running
- For Atlas: whitelist your IP address

### Port already in use
```bash
# Kill process on port 8001
lsof -ti:8001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## 🚀 Deployment

### Backend (Python/FastAPI)
- Deploy to: Heroku, Railway, Render, AWS, or DigitalOcean
- Set environment variables
- Use production MongoDB URL

### Frontend (React)
- Deploy to: Vercel, Netlify, or Cloudflare Pages
- Build: `yarn build`
- Set REACT_APP_BACKEND_URL to production backend URL

### Environment Variables for Production
```
# Backend
MONGO_URL=your_production_mongodb_url
DB_NAME=xrp_mining_base_prod
CORS_ORIGINS=https://your-frontend-domain.com
JWT_SECRET=strong-random-secret-key

# Frontend
REACT_APP_BACKEND_URL=https://your-backend-domain.com
```

## 📝 License
This is a simulation platform for educational/entertainment purposes only.

## 💡 Support
For issues or questions, check the code comments or MongoDB/FastAPI documentation.

## 🎉 Enjoy Mining XRP!
