import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthCtx = createContext(null);

// Axios instance — auto-attaches JWT
const api = axios.create({ baseURL: 'http://localhost:4000/api' });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('ts_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On 401 from any request, wipe session
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ts_token');
      localStorage.removeItem('ts_user');
    }
    return Promise.reject(err);
  }
);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('ts_user')); }
    catch { return null; }
  });
  const [loading,  setLoading]  = useState(false);
  const [verified, setVerified] = useState(false);

  // Verify stored token against server on every page load
  useEffect(() => {
    const token = localStorage.getItem('ts_token');
    if (!token) { setVerified(true); return; }

    api.get('/auth/me')
      .then(({ data }) => {
        // data.data contains the user (wrapped in {success,data,error})
        const u = data.data || data.user || data;
        localStorage.setItem('ts_user', JSON.stringify(u));
        setUser(u);
      })
      .catch(() => {
        // Token invalid / expired — clear everything
        localStorage.removeItem('ts_token');
        localStorage.removeItem('ts_user');
        setUser(null);
      })
      .finally(() => setVerified(true));
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      // Backend wraps in {success, data} or returns {token, user} directly
      const token = data.token || data.data?.token;
      const u     = data.user  || data.data?.user;
      if (!token || !u) throw new Error('Invalid response from server');
      localStorage.setItem('ts_token', token);
      localStorage.setItem('ts_user',  JSON.stringify(u));
      setUser(u);
      return { token, user: u };
    } catch (err) {
      const msg = err.response?.data?.error
        || err.message
        || 'Login failed — is the backend running on port 4000?';
      throw new Error(msg);
    } finally { setLoading(false); }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', payload);
      const token = data.token || data.data?.token;
      const u     = data.user  || data.data?.user;
      if (!token || !u) throw new Error('Invalid response from server');
      localStorage.setItem('ts_token', token);
      localStorage.setItem('ts_user',  JSON.stringify(u));
      setUser(u);
      return { token, user: u };
    } catch (err) {
      // Surface backend error message exactly (e.g. "An account with this email already exists")
      const msg = err.response?.data?.error
        || err.message
        || 'Registration failed — is the backend running on port 4000?';
      throw new Error(msg);
    } finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('ts_token');
    localStorage.removeItem('ts_user');
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, register, logout, loading, verified, api }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
export { api };
