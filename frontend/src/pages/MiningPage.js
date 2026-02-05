import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  /* ===============================
     CHECK ACTIVE SESSION (SAFE)
  =============================== */
  const checkActiveSession = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/mining/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.data) return;

      const session = res.data;
      const start = new Date(session.start_time).getTime();
      const now = Date.now();

      if (isNaN(start)) return;

      const elapsed = Math.floor((now - start) / 1000);

      setSessionId(session.id);
      setStartTime(new Date(start));
      setElapsedSeconds(elapsed);
      setMining(true);
    } catch (err) {
      console.error('Failed to check active session:', err);
    }
  }, [token]);

  /* ===============================
     RUN ON PAGE LOAD
  =============================== */
  useEffect(() => {
    checkActiveSession();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkActiveSession]);

  /* ===============================
     MINING TIMER
  =============================== */
  useEffect(() => {
    if (!mining) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;

        const minutes = next / 60;
        const baseRate = 0.1;
        const timeBonus = 1 + minutes / 60;

        const earned = minutes * baseRate * timeBonus;
        const rate = baseRate * timeBonus * 1000;

        setAccumulatedXRP(Number.isFinite(earned) ? earned : 0);
        setHashRate(Number.isFinite(rate) ? rate : 0);

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mining]);

  /* ===============================
     START MINING
  =============================== */
  const handleStartMining = async () => {
    try {
      const res = await axios.post(
        `${API}/mining/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessionId(res.data.id);
      setStartTime(new Date(res.data.start_time));
      setElapsedSeconds(0);
      setAccumulatedXRP(0);
      setHashRate(0);
      setMining(true);

      toast.success('Mining session started!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start mining');
    }
  };

  /* ===============================
     STOP MINING
  =============================== */
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

      toast.success(
        `Mining completed! Earned ${accumulatedXRP.toFixed(4)} XRP`
      );

      setMining(false);
      setSessionId(null);
      setStartTime(null);
      setElapsedSeconds(0);
      setAccumulatedXRP(0);
      setHashRate(0);

      await refreshProfile();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to stop mining');
    }
  };

  /* ===============================
     TIME FORMATTER
  =============================== */
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '00:00:00';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /* ===============================
     UI (UNCHANGED)
  =============================== */
  return (
    <div className="space-y-4 sm:space-y-6" data-testid="mining-page">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-unbounded font-bold text-white mb-2">
          Mining Center
        </h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Start mining and watch your XRP grow
        </p>
      </div>

      <div className="glass-card p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center">
          <div className="relative mb-6 sm:mb-8">
            <img
              src="https://images.unsplash.com/photo-1755282464684-6568f7f76b5d"
              alt="Mining Reactor"
              className={`w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 object-cover mining-reactor ${
                mining ? 'active' : ''
              }`}
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
              className="px-6 sm:px-8 py-3 sm:py-4 bg-destructive text-white font-bold uppercase tracking-wider hover:bg-red-600 transition-all duration-300 border border-red-400/30 flex items-center gap-3"
            >
              <Square className="w-5 h-5" />
              Stop Mining
            </button>
          ) : (
            <button
              onClick={handleStartMining}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-primary text-white font-bold uppercase tracking-wider hover:bg-blue-600 transition-all duration-300 border border-blue-400/30 neon-glow flex items-center gap-3"
            >
              <Play className="w-5 h-5" />
              Start Mining
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="glass-card p-4 sm:p-6">
          <Zap className="text-primary mb-2" />
          <p className="text-2xl font-mono font-bold text-primary">
            {hashRate.toFixed(2)} H/s
          </p>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <Clock className="text-accent mb-2" />
          <p className="text-2xl font-mono font-bold text-white">
            {formatTime(elapsedSeconds)}
          </p>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <TrendingUp className="text-accent mb-2" />
          <p className="text-2xl font-mono font-bold text-accent">
            {accumulatedXRP.toFixed(4)} XRP
          </p>
        </div>
      </div>
    </div>
  );
}
