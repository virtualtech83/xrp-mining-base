import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Medal, Award } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/leaderboard`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-accent" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Award className="w-6 h-6 text-yellow-700" />;
    return null;
  };

  const isCurrentUser = (email) => {
    return user?.email === email;
  };

  return (
    <div className="space-y-6" data-testid="leaderboard-page">
      <div>
        <h1
          className="text-4xl font-unbounded font-bold text-white mb-2"
          data-testid="leaderboard-title"
        >
          Leaderboard
        </h1>
        <p className="text-gray-400">
          Top miners in the XRP MineSim community
        </p>
      </div>

      <div className="glass-card p-6">
        {loading ? (
          <p
            className="text-gray-400"
            data-testid="loading-leaderboard"
          >
            Loading leaderboard...
          </p>
        ) : leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between p-4 transition-all duration-200 ${
                  isCurrentUser(entry.email)
                    ? 'bg-primary/20 border-2 border-primary'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
                data-testid="leaderboard-entry"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 text-center">
                    {getRankIcon(entry.rank) || (
                      <span
                        className="text-gray-400 font-mono font-bold"
                        data-testid="entry-rank"
                      >
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  <div>
                    <p
                      className="text-white font-mono font-bold"
                      data-testid="entry-email"
                    >
                      {entry.email}
                      {isCurrentUser(entry.email) && (
                        <span
                          className="ml-2 text-xs text-primary"
                          data-testid="you-badge"
                        >
                          (You)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className="text-accent font-mono font-bold text-lg"
                    data-testid="entry-total-mined"
                  >
                    {entry.total_mined?.toFixed(4)} XRP
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p
            className="text-gray-400"
            data-testid="no-leaderboard"
          >
            No miners yet. Be the first to start mining!
          </p>
        )}
      </div>

      {user && leaderboard.length > 0 && (
        <div
          className="glass-card p-6 bg-primary/10 border-primary/30"
          data-testid="leaderboard-tip"
        >
          <p className="text-white text-center">
            <span className="font-bold">
              Keep mining to climb the ranks!
            </span>{' '}
            The more you mine, the higher you'll be on the leaderboard.
          </p>
        </div>
      )}
    </div>
  );
}
