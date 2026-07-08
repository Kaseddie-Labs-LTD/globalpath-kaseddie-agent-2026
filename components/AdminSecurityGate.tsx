
import React, { useEffect, useRef, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../constants/api';

interface AdminSecurityGateProps {
  onAuthenticated: () => void;
}

export const ADMIN_TOKEN_STORAGE_KEY = 'gp_admin_auth_token';

export const AdminSecurityGate: React.FC<AdminSecurityGateProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    setIsAuthorized(false);
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        if (!isMounted.current) return;
        if (res.status === 401) {
          setError('INVALID_KEY');
        } else if (res.status === 503) {
          setError('ADMIN_AUTH_NOT_CONFIGURED');
        } else {
          setError(payload?.detail ? String(payload.detail).toUpperCase() : `AUTH_ERROR_${res.status}`);
        }
        return;
      }

      const token: string | undefined = payload?.token;
      if (!token) {
        if (!isMounted.current) return;
        setError('NO_TOKEN_RETURNED');
        return;
      }

      try {
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      } catch (storageError) {
        console.warn("Storage blocked: Active session restricted to window memory allocation.", storageError);
      }

      if (!isMounted.current) return;
      setIsAuthorized(true);
      onAuthenticated();
    } catch (err) {
      // Network / CORS / abort — never let this unmount the gate.
      console.error('[ADMIN LOGIN] Request failed:', err);
      if (isMounted.current) setError('NETWORK_ERROR');
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#031B4E] flex items-center justify-center">
        <div className="w-full max-w-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-white/10 rounded-xl"><Lock size={20} /></div>
            <div className="text-[10px] font-black uppercase tracking-widest">Admin Access Required</div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Admin Password"
              disabled={isSubmitting}
              className="w-full bg-black/30 border border-white/20 rounded-xl py-3 px-4 text-sm outline-none disabled:opacity-50"
            />
            {error && <div className="text-[10px] text-amber-300 font-black uppercase">
              {typeof error === 'object' 
                ? (error as any)?.message || (error as any)?.details || JSON.stringify(error) 
                : error}
            </div>}
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={12} className="animate-spin" />}
              {isSubmitting ? 'Authenticating...' : 'Unlock Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
};
