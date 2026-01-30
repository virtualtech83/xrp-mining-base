import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Wallet, Gift, TrendingUp, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const { user, token, refreshProfile } = useAuth();
  const [dailyRewardStatus, setDailyRewardStatus] = useState(null);
  const [claimingReward, setClaimingReward] = useState(false);
  const [miningHistory, setMiningHistory] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    fetchDailyRewardStatus();
    fetchMiningHistory();
    fetchActiveSession();
  }, []);

  const fetchDailyRewardStatus = async () => {
    try {
      const response = await axios.get(`${API}/rewards/daily/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDailyRewardStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch daily reward status:', error);
    }
  };

  const fetchMiningHistory = async () => {
    try {
      const response = await axios.get(`${API}/mining/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMiningHistory(response.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch mining history:', error);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const response = await axios.get(`${API}/mining/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveSession(response.data);
    } catch (error) {
      console.error('Failed to fetch active session:', error);
    }
  };

  const handleClaimDailyReward = async () => {
    setClaimingReward(true);
    try {
      const response = await axios.post(
        `${API}/rewards/daily`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Claimed ${response.data.reward_amount} XRP!`);
      await refreshProfile();
      await fetchDailyRewardStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to claim reward');
    } finally {
      setClaimingReward(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeUntilNextClaim = () => {
    if (!dailyRewardStatus?.next_claim_time) return '';
    const now = new Date();
    const nextClaim = new Date(dailyRewardStatus.next_claim_time);
    const diff = nextClaim - now;
    
    if (diff <= 0) return 'Available now!';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="dashboard">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-unbounded font-bold text-white mb-2" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-gray-400 text-sm sm:text-base">Welcome back, miner!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="md:col-span-2 glass-card p-4 sm:p-6 lg:p-8" data-testid="balance-card">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h2 className="text-lg sm:text-xl font-unbounded font-bold text-white">Your Balance</h2>
          </div>
          <div className="balance-display text-3xl sm:text-4xl" data-testid="balance-amount">
            {user?.xrp_balance?.toFixed(4) || '0.0000'} XRP
          </div>
          <p className="text-gray-400 mt-2 text-xs sm:text-sm font-mono">Total Mined: {user?.total_mined?.toFixed(4) || '0.0000'} XRP</p>
        </div>

        <div className="glass-card p-4 sm:p-6" data-testid="daily-reward-card">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
            <h2 className="text-base sm:text-lg font-unbounded font-bold text-white">Daily Reward</h2>
          </div>
          {dailyRewardStatus?.can_claim ? (
            <button
              onClick={handleClaimDailyReward}
              disabled={claimingReward}
              data-testid="claim-reward-button"
              className="w-full px-4 py-3 bg-accent text-black font-bold uppercase tracking-wider hover:bg-yellow-600 transition-all duration-300 neon-glow-gold disabled:opacity-50"
            >
              {claimingReward ? 'Claiming...' : 'Claim 5 XRP'}
            </button>
          ) : (
            <div className="text-center" data-testid="reward-cooldown">
              <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Next claim in</p>
              <p className="text-white font-mono font-bold mt-1">{getTimeUntilNextClaim()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-6" data-testid="mining-status-card">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          <h2 className="text-lg sm:text-xl font-unbounded font-bold text-white">Mining Status</h2>
        </div>
        {activeSession ? (
          <div className="bg-primary/10 border border-primary/30 p-4">
            <p className="text-primary font-bold text-lg" data-testid="mining-active-status">Mining Session Active</p>
            <p className="text-gray-400 text-sm mt-1">Go to Mining page to view details</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 p-4">
            <p className="text-gray-400" data-testid="mining-idle-status">No active mining session</p>
          </div>
        )}
      </div>

      <div className="glass-card p-6" data-testid="recent-history-card">
        <h2 className="text-xl font-unbounded font-bold text-white mb-4">Recent Mining Sessions</h2>
        {miningHistory.length > 0 ? (
          <div className="space-y-3">
            {miningHistory.map((session) => (
              <div
                key={session.id}
                className="flex justify-between items-center bg-white/5 border border-white/10 p-4"
                data-testid="history-item"
              >
                <div>
                  <p className="text-white font-mono text-sm">{formatDate(session.start_time)}</p>
                  <p className="text-gray-400 text-xs mt-1">{session.duration_minutes?.toFixed(1)} minutes</p>
                </div>
                <div className="text-right">
                  <p className="text-accent font-mono font-bold" data-testid="session-earnings">
                    +{session.xrp_earned?.toFixed(4)} XRP
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400" data-testid="no-history">No mining sessions yet. Start mining to see your history!</p>
        )}
      </div>
    </div>
  );
}
