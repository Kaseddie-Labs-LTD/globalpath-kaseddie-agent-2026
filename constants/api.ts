// API Base URL configuration
export const API_BASE = import.meta.env.VITE_API_URL || "https://globalpath-kaseddie-agent-2026-1.onrender.com";

// Fetcher function for SWR that automatically adds API prefix
export const fetcher = async (url: string, options?: RequestInit) => {
  // Ensure that URL starts with /api if it's a backend call
  const apiPath = url.startsWith('/api') ? url : `/api${url}`;
  const fullUrl = `${API_BASE}${apiPath}`;
  
  console.log(' [FETCHER DEBUG]: Full URL:', fullUrl);
  
  const res = await fetch(fullUrl, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);  
  // This check prevents "Unexpected token <" error when backend returns HTML instead of JSON
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(' [FETCHER ERROR]: Backend returned HTML instead of JSON:', contentType);
    throw new Error("Oops! Backend returned HTML instead of JSON. Check your API paths.");
  }
  
  return res.json();
};
