import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Play, Square, Zap, Clock, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MiningPage() {
  const { token, refreshProfile } = useAuth();
  const [mining, setMining] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [accumulatedXRP, setAccumulatedXRP] = useState(0);
  const [hashRate, setHashRate] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    checkActiveSession();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (mining) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newElapsed = prev + 1;
          const minutes = newElapsed / 60;
          const baseRate = 0.1;
          const timeBonus = 1 + (minutes / 60);
          const earnedXRP = minutes * baseRate * timeBonus;
          setAccumulatedXRP(earnedXRP);
          setHashRate(baseRate * timeBonus * 1000);
          return newElapsed;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mining]);

  const checkActiveSession = async () => {
    try {
      const response = await axios.get(`${API}/mining/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        const session = response.data;
        setSessionId(session.id);
        setStartTime(new Date(session.start_time));
        const elapsed = Math.floor((new Date() - new Date(session.start_time)) / 1000);
        setElapsedSeconds(elapsed);
        setMining(true);
      }
    } catch (error) {
      console.error('Failed to check active session:', error);
    }
  };

  const handleStartMining = async () => {
    try {
      const response = await axios.post(
        `${API}/mining/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessionId(response.data.id);
      setStartTime(new Date(response.data.start_time));
      setElapsedSeconds(0);
      setAccumulatedXRP(0);
      setMining(true);
      toast.success('Mining session started!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start mining');
    }
  };

  const handleStopMining = async () => {
    try {
      const durationMinutes = elapsedSeconds / 60;
      await axios.post(
        `${API}/mining/stop`,
        {
          session_id: sessionId,
          duration_minutes: durationMinutes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Mining completed! Earned ${accumulatedXRP.toFixed(4)} XRP`);
      setMining(false);
      setSessionId(null);
      setStartTime(null);
      setElapsedSeconds(0);
      setAccumulatedXRP(0);
      setHashRate(0);
      await refreshProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to stop mining');
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="mining-page">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-unbounded font-bold text-white mb-2" data-testid="mining-title">Mining Center</h1>
        <p className="text-gray-400 text-sm sm:text-base">Start mining and watch your XRP grow</p>
      </div>

      <div className="glass-card p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center">
          <div className="relative mb-6 sm:mb-8">
            <img
              src="https://images.unsplash.com/photo-1755282464684-6568f7f76b5d"
              alt="Mining Reactor"
              className={`w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 object-cover mining-reactor ${mining ? 'active' : ''}`}
              data-testid="mining-reactor"
            />
            {mining && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full border-4 border-primary animate-ping opacity-20"></div>
              </div>
            )}
          </div>

          {mining ? (
            <button
              onClick={handleStopMining}
              data-testid="stop-mining-button"
              className="px-8 py-4 bg-destructive text-white font-bold uppercase tracking-wider hover:bg-red-600 transition-all duration-300 border border-red-400/30 flex items-center gap-3"
            >
              <Square className="w-5 h-5" />
              Stop Mining
            </button>
          ) : (
            <button
              onClick={handleStartMining}
              data-testid="start-mining-button"
              className="px-8 py-4 bg-primary text-white font-bold uppercase tracking-wider hover:bg-blue-600 transition-all duration-300 border border-blue-400/30 neon-glow flex items-center gap-3"
            >
              <Play className="w-5 h-5" />
              Start Mining
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6" data-testid="hashrate-card">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-unbounded font-bold text-white">Hash Rate</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-primary" data-testid="hashrate-value">
            {hashRate.toFixed(2)} H/s
          </p>
        </div>

        <div className="glass-card p-6" data-testid="session-time-card">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-accent" />
            <h3 className="font-unbounded font-bold text-white">Session Time</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-white" data-testid="session-time-value">
            {formatTime(elapsedSeconds)}
          </p>
        </div>

        <div className="glass-card p-6" data-testid="accumulated-xrp-card">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h3 className="font-unbounded font-bold text-white">Accumulated</h3>
          </div>
          <p className="text-3xl font-mono font-bold text-accent" data-testid="accumulated-xrp-value">
            {accumulatedXRP.toFixed(4)} XRP
          </p>
        </div>
      </div>

      {mining && (
        <div className="glass-card p-6 bg-primary/10 border-primary/30">
          <p className="text-white text-center" data-testid="mining-tip">
            <span className="font-bold">Tip:</span> The longer you mine, the higher your rewards! Mining rate increases over time.
          </p>
        </div>
      )}
    </div>
  );
}
