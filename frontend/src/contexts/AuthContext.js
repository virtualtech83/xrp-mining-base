import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import axios from 'axios';

/* =========================
   CONFIG
========================= */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

if (!BACKEND_URL) {
  console.error(
    'REACT_APP_BACKEND_URL is not defined. Check Vercel env variables.'
  );
}

const API = `${BACKEND_URL}/api`;

const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

/* =========================
   CONTEXT
========================= */

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/* =========================
   PROVIDER
========================= */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(
    () => localStorage.getItem('token')
  );

  /* =========================
     INIT
  ========================= */

  useEffect(() => {
    if (token) {
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     HELPERS
  ========================= */

  const fetchUserProfile = async (authToken) => {
    try {
      const response = await apiClient.get('/user/profile', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      setUser(response.data);
      setToken(authToken);
    } catch (error) {
      console.error(
        'Failed to fetch user profile:',
        error?.response || error
      );
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     AUTH ACTIONS
  ========================= */

  const register = async (email, password, referralCode) => {
    const response = await apiClient.post('/auth/register', {
      email,
      password,
      referral_code: referralCode || null,
    });

    const { token: newToken } = response.data;

    // Save token immediately
    localStorage.setItem('token', newToken);
    setToken(newToken);

    // Fetch profile, but don't fail registration if this errors
    fetchUserProfile(newToken).catch((err) => {
      console.warn('Profile fetch delayed:', err);
    });

    return response.data;
  };

  const login = async (email, password) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    const { token: newToken } = response.data;

    localStorage.setItem('token', newToken);
    setToken(newToken);

    fetchUserProfile(newToken).catch((err) => {
      console.warn('Profile fetch delayed:', err);
    });

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchUserProfile(token);
    }
  };

  /* =========================
     CONTEXT VALUE
  ========================= */

  const value = {
    user,
    token,
    loading,
    register,
    login,
    logout,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
