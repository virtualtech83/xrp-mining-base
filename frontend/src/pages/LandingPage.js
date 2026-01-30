import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Shield, TrendingUp, Users } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505]">
      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/17323801/pexels-photo-17323801.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="absolute inset-0 grid-bg opacity-30"></div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-unbounded font-bold text-white mb-6" data-testid="hero-title">
            MINE XRP.
            <br />
            <span className="text-primary">SIMULATE WEALTH.</span>
            <br />
            DOMINATE.
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Experience the thrill of XRP mining in a realistic simulation. Start mining, earn rewards, and climb the leaderboard.
          </p>
          <button
            onClick={() => navigate('/auth')}
            data-testid="cta-button"
            className="px-8 py-4 bg-primary text-white font-bold uppercase tracking-wider hover:bg-blue-600 transition-all duration-300 border border-blue-400/30 neon-glow text-lg"
          >
            START MINING NOW
          </button>
        </div>
      </div>

      <div className="py-24 px-4 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card p-6 stat-card" data-testid="feature-card-realistic">
              <Zap className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-unbounded font-bold text-white mb-2">Realistic Mining</h3>
              <p className="text-gray-400 text-sm">Experience authentic mining mechanics with increasing rewards over time.</p>
            </div>

            <div className="glass-card p-6 stat-card" data-testid="feature-card-secure">
              <Shield className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-unbounded font-bold text-white mb-2">Secure Platform</h3>
              <p className="text-gray-400 text-sm">Your account and earnings are protected with enterprise-grade security.</p>
            </div>

            <div className="glass-card p-6 stat-card" data-testid="feature-card-rewards">
              <TrendingUp className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-unbounded font-bold text-white mb-2">Daily Rewards</h3>
              <p className="text-gray-400 text-sm">Claim free XRP every 24 hours and boost your earnings.</p>
            </div>

            <div className="glass-card p-6 stat-card" data-testid="feature-card-referral">
              <Users className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-unbounded font-bold text-white mb-2">Referral System</h3>
              <p className="text-gray-400 text-sm">Invite friends and earn bonus XRP for every referral.</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-8 bg-black/90 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>© 2025 XRP MineSim. All rights reserved. This is a simulation platform for entertainment purposes.</p>
        </div>
      </footer>
    </div>
  );
}
