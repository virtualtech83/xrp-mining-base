import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wallet, Pickaxe, History, Users, Trophy, LogOut, ArrowDownToLine, Menu, X, Coins } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] grid-bg">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 min-h-screen glass-card border-r border-white/10">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center neon-glow">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-unbounded font-bold text-white" data-testid="app-title">
                XRP Mining Base
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono ml-13" data-testid="user-email">{user?.email}</p>
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

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/80 z-40"
            onClick={() => setMobileMenuOpen(false)}
            data-testid="mobile-menu-overlay"
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 glass-card border-r border-white/10 z-50 transform transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center neon-glow">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-unbounded font-bold text-white" data-testid="app-title-mobile">
                  XRP Mining Base
                </h1>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                data-testid="close-mobile-menu"
                className="text-white hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-xs text-gray-400 font-mono ml-10" data-testid="user-email-mobile">{user?.email}</p>
          </div>

          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  data-testid={`nav-mobile-${item.name.toLowerCase()}`}
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
              data-testid="logout-button-mobile"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          {/* Mobile Header */}
          <header className="lg:hidden glass-card border-b border-white/10 p-4 flex items-center justify-between">
            <button
              onClick={() => setMobileMenuOpen(true)}
              data-testid="open-mobile-menu"
              className="text-white hover:text-gray-300"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center neon-glow">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-base font-unbounded font-bold text-white" data-testid="page-title-mobile">
                XRP Mining Base
              </h1>
            </div>
            <div className="w-6"></div>
          </header>

          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
