import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowDownToLine, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function WithdrawalPage() {
  const { user, token, refreshProfile } = useAuth();

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // 🔹 NEW: modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const fetchWithdrawalHistory = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API}/withdrawal/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch withdrawal history:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchWithdrawalHistory();
  }, [fetchWithdrawalHistory]);

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    const withdrawalAmount = parseFloat(amount);

    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (withdrawalAmount > user?.xrp_balance) {
      toast.error('Insufficient balance');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/withdrawal/request`,
        { amount: withdrawalAmount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Withdrawal request submitted successfully!');
      setAmount('');

      await refreshProfile();
      await fetchWithdrawalHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Withdrawal request failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6" data-testid="withdrawal-page">
      <div>
        <h1 className="text-4xl font-unbounded font-bold text-white mb-2">
          Withdraw XRP
        </h1>
        <p className="text-gray-400">
          Request a withdrawal from your balance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-unbounded font-bold text-white mb-4">
            New Withdrawal
          </h2>

          <div className="bg-primary/10 border border-primary/30 p-4 mb-6">
            <p className="text-white font-mono text-sm">
              Available Balance:{' '}
              <span className="font-bold text-primary">
                {user?.xrp_balance?.toFixed(4) || '0.0000'} XRP
              </span>
            </p>
          </div>

          <form onSubmit={handleWithdrawal} className="space-y-4">
            <div>
              <Label htmlFor="amount" className="text-white mb-2 block">
                Withdrawal Amount (XRP)
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.0001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white h-12"
                placeholder="0.0000"
              />
            </div>

           {/* 🔹 NEW BUTTON  <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-primary text-white font-bold uppercase tracking-wider hover:bg-blue-600 transition-all border border-blue-400/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowDownToLine className="w-5 h-5" />
              {loading ? 'Processing...' : 'Request Withdrawal'}
            </button> */}
                   {/* 🔹 NEW BUTTON */}
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="w-full mt-4 px-6 py-4 bg-green-600 text-white font-bold uppercase tracking-wider hover:bg-green-700 transition-all border border-green-400/30"
          >
            Withdraw to Wallet
          </button>
          </form>

         

          <div className="mt-6 bg-white/5 border border-white/10 p-4">
            <p className="text-gray-400 text-xs">
              <span className="font-bold text-white">Note:</span> This is a simulation.
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-unbounded font-bold text-white">
              Withdrawal History
            </h2>
          </div>

          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="bg-white/5 border border-white/10 p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-white font-mono font-bold">
                      {withdrawal.amount?.toFixed(4)} XRP
                    </p>
                    <span className="text-xs px-2 py-1 bg-accent/20">
                      {withdrawal.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs">
                    {formatDate(withdrawal.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No withdrawal requests yet.</p>
          )}
        </div>
      </div>

      {/* 🔹 MODAL + IFRAME */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="relative w-[95%] max-w-md h-[520px] bg-black border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-3 right-3 z-50 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >
              ✕
            </button>

            <iframe
              src="/withdrawprocess.html"
              title="Withdraw Process"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
