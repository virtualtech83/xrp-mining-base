import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Users, Gift } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ReferralPage() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferralStats();
  }, []);

  const fetchReferralStats = async () => {
    try {
      const response = await axios.get(`${API}/referral/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReferralLink = () => {
    if (!user?.referral_code) return '';
    return `${window.location.origin}/auth?ref=${user.referral_code}`;
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(getReferralLink());
    toast.success('Referral link copied to clipboard!');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6" data-testid="referral-page">
      <div>
        <h1 className="text-4xl font-unbounded font-bold text-white mb-2" data-testid="referral-title">Referral Program</h1>
        <p className="text-gray-400">Invite friends and earn 10 XRP per referral</p>
      </div>

      <div className="glass-card p-6" data-testid="referral-link-card">
        <h2 className="text-xl font-unbounded font-bold text-white mb-4">Your Referral Link</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={getReferralLink()}
            readOnly
            data-testid="referral-link-input"
            className="flex-1 bg-white/5 border border-white/10 text-white px-4 py-3 font-mono text-sm"
          />
          <button
            onClick={copyReferralLink}
            data-testid="copy-referral-button"
            className="px-6 py-3 bg-primary text-white font-bold uppercase tracking-wider hover:bg-blue-600 transition-all duration-300 border border-blue-400/30 flex items-center gap-2"
          >
            <Copy className="w-5 h-5" />
            Copy
          </button>
        </div>
        <p className="text-gray-400 text-sm mt-3">
          Share this link with friends. You'll earn 10 XRP when they sign up!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6" data-testid="total-referrals-card">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-unbounded font-bold text-white">Total Referrals</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-white" data-testid="total-referrals">
            {stats?.total_referrals || 0}
          </p>
        </div>

        <div className="glass-card p-6" data-testid="referral-earnings-card">
          <div className="flex items-center gap-3 mb-3">
            <Gift className="w-5 h-5 text-accent" />
            <h3 className="font-unbounded font-bold text-white">Referral Earnings</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-accent" data-testid="referral-earnings">
            {stats?.total_rewards?.toFixed(4) || '0.0000'} XRP
          </p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-unbounded font-bold text-white mb-4">Referred Users</h2>
        {loading ? (
          <p className="text-gray-400" data-testid="loading-referrals">Loading...</p>
        ) : stats?.referred_users && stats.referred_users.length > 0 ? (
          <div className="space-y-3">
            {stats.referred_users.map((referredUser, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white/5 border border-white/10 p-4"
                data-testid="referred-user-item"
              >
                <div>
                  <p className="text-white font-mono text-sm" data-testid="referred-user-email">{referredUser.email}</p>
                  <p className="text-gray-400 text-xs mt-1">Joined: {formatDate(referredUser.joined_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-accent font-mono font-bold" data-testid="referral-reward">
                    +{referredUser.reward?.toFixed(4)} XRP
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400" data-testid="no-referrals">No referrals yet. Share your link to start earning!</p>
        )}
      </div>
    </div>
  );
}
