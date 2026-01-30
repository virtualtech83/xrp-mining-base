import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      setIsLogin(false);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Login successful!');
      } else {
        await register(email, password, referralCode);
        toast.success('Account created successfully!');
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] grid-bg flex items-center justify-center px-4">
      <div className="glass-card p-8 w-full max-w-md">
        <h1 className="text-3xl font-unbounded font-bold text-white mb-2 text-center" data-testid="auth-title">
          {isLogin ? 'Welcome Back' : 'Join XRP MineSim'}
        </h1>
        <p className="text-gray-400 text-center mb-8 text-sm">
          {isLogin ? 'Login to continue mining' : 'Create your account and start mining'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-white mb-2 block">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="email-input"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:ring-1 focus:ring-primary h-12"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-white mb-2 block">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="password-input"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:ring-1 focus:ring-primary h-12"
              placeholder="••••••••"
            />
          </div>

          {!isLogin && (
            <div>
              <Label htmlFor="referralCode" className="text-white mb-2 block">Referral Code (Optional)</Label>
              <Input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                data-testid="referral-input"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:ring-1 focus:ring-primary h-12"
                placeholder="Enter referral code"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="auth-submit-button"
            className="w-full px-6 py-4 bg-primary text-white font-bold uppercase tracking-wider hover:bg-blue-600 transition-all duration-300 border border-blue-400/30 neon-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            data-testid="toggle-auth-mode"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
