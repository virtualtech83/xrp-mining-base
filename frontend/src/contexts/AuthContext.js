import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      fetchUserProfile(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (authToken) => {
    try {
      const response = await axios.get(`${API}/user/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setUser(response.data);
      setToken(authToken);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, referralCode) => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      referral_code: referralCode || null,
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    await fetchUserProfile(newToken);
    return userData;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, {
      email,
      password,
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    await fetchUserProfile(newToken);
    return userData;
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

  const value = {
    user,
    token,
    loading,
    register,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
