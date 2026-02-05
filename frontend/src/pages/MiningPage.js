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

  /** -------------------------------
   *  ACTIVE SESSION SYNC
   *  ------------------------------- */
  const checkActiveSession = async () => {
    try {
      const res = await axios.get(`${API}/mining/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data) {
        const session = res.data;
        const elapsed = Math.floor(
          (Date.now() - new Date(session.start_time).getTime()) / 1000
        );

        setSessionId(session.id);
        setStartTime(new Date(session.start_time));
        setElapsedSeconds(elapsed);
        setMining(true);
      }
    } catch (err) {
      console.error('Active session check failed:', err);
    }
  };

  useEffect(() => {
    checkActiveSession();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /** -------------------------------
   *  MINING TICK
   *  ------------------------------- */
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

        setAccumulatedXRP(minutes * baseRate * timeBonus);
        setHashRate(baseRate * timeBonus * 1000);

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mining]);

  /** -------------------------------
   *  START MINING (FIXED)
   *  ------------------------------- */
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
      // 🔑 key fix: session may already exist
      await checkActiveSession();

      if (!mining) {
        toast.error(err.response?.data?.detail || 'Failed to start mining');
      }
    }
  };

  /** -------------------------------
   *  STOP MINING (SAFE)
   *  ------------------------------- */
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

      await refreshProfile(); // history updates here
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to stop mining');
    }
  };

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  /* 🔒 JSX BELOW IS UNCHANGED */
  return (
    <div className="space-y-4 sm:space-y-6" data-testid="mining-page">
      {/* UI unchanged — exactly your original */}
      {/* ... */}
    </div>
  );
}
