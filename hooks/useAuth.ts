import { useState, useEffect } from 'react';
import { ADMIN_TOKEN_STORAGE_KEY } from '../constants/api';

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
    const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    
    if (!token) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }

    fetch('/api/auth/user', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401) {
          setState({ user: null, isLoading: false, isAuthenticated: false });
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setState({ user: data, isLoading: false, isAuthenticated: true });
        }
      })
      .catch(() => {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      });
  }, []);

  return state;
}
