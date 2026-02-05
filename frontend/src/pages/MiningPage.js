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

  /* ------------------ CHECK ACTIVE SESSION ------------------ */
  const checkActiveSession = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/mining/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const session = res.data;

      // ✅ ONLY resume if session is valid and active
      if (session && session.status === 'active' && session.start_time) {
        const start = new Date(session.start_time);
        const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);

        setSessionId(session.id);
        setStartTime(start);
        setElapsedSeconds(elapsed > 0 ? elapsed : 0);
        setMining(true);
      } else {
        resetMiningState();
      }
    } catch {
      resetMiningState();
    }
  }, [token]);

  /* ------------------ TIMER ------------------ */
  useEffect(() => {
    if (!mining) return;

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        const minutes = next / 60;

        const baseRate = 0.1;
        const timeBonus = 1 + minutes / 60;

        const earned = minutes * baseRate * timeBonus;

        setAccumulatedXRP(Number.isFinite(earned) ? earned : 0);
        setHashRate(Number.isFinite(baseRate * timeBonus * 1000)
          ? baseRate * timeBonus * 1000
          : 0
        );

        return next;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [mining]);

  useEffect(() => {
    checkActiveSession();
    return () => clearInterval(intervalRef.current);
  }, [checkActiveSession]);

  /* ------------------ START ------------------ */
  const handleStartMining = async () => {
    try {
      const res = await axios.post(
        `${API}/mining/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const session = res.data.session || res.data;

      setSessionId(session.id);
      setStartTime(new Date(session.start_time));
      setElapsedSeconds(0);
      setAccumulatedXRP(0);
      setHashRate(0);
      setMining(true);

      toast.success('Mining started');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start mining');
    }
  };

  /* ------------------ STOP ------------------ */
  const handleStopMining = async () => {
    try {
      await axios.post(
        `${API}/mining/stop`,
        {
          session_id: sessionId,
          duration_minutes: elapsedSeconds / 60,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Earned ${accumulatedXRP.toFixed(4)} XRP`);

      resetMiningState();
      await refreshProfile();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to stop mining');
    }
  };

  /* ------------------ RESET ------------------ */
  const resetMiningState = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    setMining(false);
    setSessionId(null);
    setStartTime(null);
    setElapsedSeconds(0);
    setAccumulatedXRP(0);
    setHashRate(0);
  };

  const formatTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(
      Math.floor((s % 3600) / 60)
    ).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* ------------------ UI ------------------ */
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Mining Center</h1>

      <div className="glass-card p-6 text-center">
        {mining ? (
          <button onClick={handleStopMining} className="bg-red-600 px-6 py-3 text-white">
            <Square /> Stop Mining
          </button>
        ) : (
          <button onClick={handleStartMining} className="bg-blue-600 px-6 py-3 text-white">
            <Play /> Start Mining
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>⚡ {hashRate.toFixed(2)} H/s</div>
        <div>⏱ {formatTime(elapsedSeconds)}</div>
        <div>📈 {accumulatedXRP.toFixed(4)} XRP</div>
      </div>
    </div>
  );
}
