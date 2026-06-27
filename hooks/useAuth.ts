import { useState, useEffect } from 'react';
import { ADMIN_TOKEN_STORAGE_KEY, fetcher } from '../constants/api';

export interface ReplitUser {
  sub: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface AuthState {
  user: ReplitUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      // Use our custom fetcher to get the correct BACKEND_URL!
      fetcher('/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(data => {
          if (data && typeof data === 'object') {
            setState({ user: data as ReplitUser, isLoading: false, isAuthenticated: true });
          } else {
            setState({ user: null, isLoading: false, isAuthenticated: false });
          }
        })
        .catch((err) => {
          console.warn('Auth fetch failed (optional for dashboard)', err);
          setState({ user: null, isLoading: false, isAuthenticated: false });
        });
    } catch (error) {
      console.warn('Auth hook error (optional for dashboard)', error);
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  return state;
}
