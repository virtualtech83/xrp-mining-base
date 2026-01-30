import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HistoryPage() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/mining/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTotalEarned = () => {
    return sessions.reduce((sum, session) => sum + (session.xrp_earned || 0), 0);
  };

  const getTotalTime = () => {
    return sessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
  };

  return (
    <div className="space-y-6" data-testid="history-page">
      <div>
        <h1 className="text-4xl font-unbounded font-bold text-white mb-2" data-testid="history-title">Mining History</h1>
        <p className="text-gray-400">View all your completed mining sessions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6" data-testid="total-sessions-card">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-unbounded font-bold text-white">Total Sessions</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-white" data-testid="total-sessions">
            {sessions.length}
          </p>
          <p className="text-gray-400 text-sm mt-1">{getTotalTime().toFixed(1)} minutes mined</p>
        </div>

        <div className="glass-card p-6" data-testid="total-earned-card">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h3 className="font-unbounded font-bold text-white">Total Earned</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-accent" data-testid="total-earned">
            {getTotalEarned().toFixed(4)} XRP
          </p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-unbounded font-bold text-white mb-4">All Sessions</h2>
        {loading ? (
          <p className="text-gray-400" data-testid="loading-history">Loading...</p>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col md:flex-row md:justify-between md:items-center bg-white/5 border border-white/10 p-4 gap-2"
                data-testid="session-item"
              >
                <div>
                  <p className="text-white font-mono text-sm" data-testid="session-date">
                    {formatDate(session.start_time)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Duration: {session.duration_minutes?.toFixed(1)} minutes
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-accent font-mono font-bold" data-testid="session-amount">
                    +{session.xrp_earned?.toFixed(4)} XRP
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Rate: {((session.xrp_earned / session.duration_minutes) * 60).toFixed(4)} XRP/hr
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400" data-testid="no-sessions">No mining sessions yet. Start mining to build your history!</p>
        )}
      </div>
    </div>
  );
}
