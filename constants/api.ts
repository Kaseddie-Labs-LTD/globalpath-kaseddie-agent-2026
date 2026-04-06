// API Base URL configuration
export const API_BASE = import.meta.env.VITE_API_URL || "https://globalpath-kaseddie-agent-2026-1.onrender.com";

// Fetcher function for SWR that automatically adds API prefix
export const fetcher = (url: string) => {
  const fullUrl = `${API_BASE}${url.startsWith('/api') ? url : `/api${url}`}`;
  return fetch(fullUrl)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
};
