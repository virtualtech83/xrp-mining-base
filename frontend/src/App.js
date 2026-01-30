import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import MiningPage from '@/pages/MiningPage';
import HistoryPage from '@/pages/HistoryPage';
import ReferralPage from '@/pages/ReferralPage';
import WithdrawalPage from '@/pages/WithdrawalPage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import DashboardLayout from '@/components/DashboardLayout';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import '@/App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mining"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MiningPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <HistoryPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/referral"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ReferralPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/withdrawal"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WithdrawalPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LeaderboardPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
