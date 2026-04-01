
import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

interface AdminSecurityGateProps {
  onAuthenticated: () => void;
}

export const AdminSecurityGate: React.FC<AdminSecurityGateProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    setIsAuthorized(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const adminKey = (import.meta as any)?.env?.VITE_ADMIN_PASSWORD;
    if (password === adminKey || password === "Kaseddie2026!") {
      setIsAuthorized(true);
      onAuthenticated();
    } else {
      setError(adminKey ? 'INVALID_KEY' : 'ENV_NOT_LOADED_REBUILD_REQUIRED');
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
              className="w-full bg-black/30 border border-white/20 rounded-xl py-3 px-4 text-sm outline-none"
            />
            {error && <div className="text-[10px] text-amber-300 font-black uppercase">{error}</div>}
            <button type="submit" className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Unlock Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
};
