// API Base URL configuration
// Detect if we are in production (on Render) or local development
const isProd = import.meta.env.PROD;
const BACKEND_URL = isProd 
  ? 'https://globalpath-kaseddie-agent-2026.onrender.com/api' // Production Backend
  : '/api'; // Local Proxy

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Sanitize endpoint to prevent URL duplication
export const sanitizeEndpoint = (endpoint: string): string => {
  // Remove any hardcoded production URLs
  const cleanEndpoint = endpoint.replace(/https:\/\/[^\/]+/g, '');
  // Remove any leading /api/ to prevent duplication
  const noApiPrefix = cleanEndpoint.replace(/^\/api\//, '');
  // Ensure single leading slash
  return noApiPrefix.startsWith('/') ? noApiPrefix : `/${noApiPrefix}`;
};

// Fetcher function for SWR that automatically adds API prefix
export const fetcher = async (url: string, options?: RequestInit) => {
  // 1. If the URL already starts with /api, remove it so we don't double up
  const path = url.startsWith('/api') ? url.replace('/api', '') : url;
  
  // 2. Ensure path starts with a single slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // 3. Final URL construction
  const fullUrl = `${BACKEND_URL}${cleanPath}`;
  
  console.log(' [FIXED PRODUCTION FETCH]:', fullUrl);
  
  const res = await fetch(fullUrl, options);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  // This check prevents "Unexpected token <" error when backend returns HTML instead of JSON
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(' [FETCHER ERROR]: Backend returned HTML instead of JSON:', contentType);
    throw new Error("Oops! Backend returned HTML instead of JSON. Check your API paths.");
  }
  
  return res.json();
};
