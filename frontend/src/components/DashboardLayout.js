import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wallet, Pickaxe, History, Users, Trophy, LogOut, ArrowDownToLine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Wallet },
    { name: 'Mining', path: '/mining', icon: Pickaxe },
    { name: 'History', path: '/history', icon: History },
    { name: 'Referral', path: '/referral', icon: Users },
    { name: 'Withdraw', path: '/withdrawal', icon: ArrowDownToLine },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ];

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#050505] grid-bg">
      <div className="flex">
        <aside className="w-64 min-h-screen glass-card border-r border-white/10">
          <div className="p-6">
            <h1 className="text-2xl font-unbounded font-bold text-white mb-2" data-testid="app-title">
              XRP MineSim
            </h1>
            <p className="text-xs text-gray-400 font-mono" data-testid="user-email">{user?.email}</p>
          </div>

          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-white border-l-4 border-primary'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-6 left-0 right-0 px-6">
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
