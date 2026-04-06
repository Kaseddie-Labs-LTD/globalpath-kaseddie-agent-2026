// API Base URL configuration
// Detect if we are in production (on Render) or local development
const isProd = import.meta.env.PROD;
const BACKEND_URL = isProd 
  ? 'https://globalpath-kaseddie-agent-2026-1.onrender.com/api' // Production Backend
  : '/api'; // Local Proxy

export const API_BASE = import.meta.env.VITE_API_URL || "https://globalpath-kaseddie-agent-2026-1.onrender.com";

// Fetcher function for SWR that automatically adds API prefix
export const fetcher = async (url: string, options?: RequestInit) => {
  // 1. Clean the URL (remove existing /api if present to avoid /api/api)
  const cleanUrl = url.startsWith('/api') ? url.replace('/api', '') : url;
  
  // 2. Build the final absolute URL
  const fullUrl = `${BACKEND_URL}${cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`}`;
  
  console.log('🚀 [PRODUCTION FETCH]:', fullUrl);
  
  const res = await fetch(fullUrl, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);  
  // This check prevents "Unexpected token <" error when backend returns HTML instead of JSON
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error('❌ [FETCHER ERROR]: Backend returned HTML instead of JSON:', contentType);
    throw new Error("Oops! Backend returned HTML instead of JSON. Check your API paths.");
  }
  
  return res.json();
};
