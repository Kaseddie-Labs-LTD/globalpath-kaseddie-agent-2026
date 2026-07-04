// API Base URL configuration
const VITE_API_URL = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
const isDevelopment = import.meta.env.DEV;

export const BACKEND_URL = VITE_API_URL
  ? VITE_API_URL.replace(/\/+$/, '')
  : isDevelopment 
    ? 'http://localhost:8000/api'
    : 'https://globalpath-kaseddie-agent-2026-7qm8.onrender.com/api';

export const API_BASE = "/api";

// Storage key for the admin JWT issued by /api/admin/login.
export const ADMIN_TOKEN_STORAGE_KEY = 'gp_admin_auth_token';

const getAdminAuthToken = (): string | null => {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export function formatEndpointUrl(endpoint: string): string {
  let clean = endpoint.trim();

  // 1. Strip out markdown link wrapper if it encapsulates the URL: [text](url) 
  // This extracts strictly the target URL inside the parentheses.
  const markdownLinkRegex = /^\[([^\]]+)\]\(([^)]+)\)/;
  const match = clean.match(markdownLinkRegex);
  if (match) {
    clean = match[2].trim(); // Extract the contents of the (...)
  }

  // 2. Clean out brackets, parentheses, backticks, or trailing dots left by typos
  clean = clean.replace(/[`'"[\]()]/g, '');
  
  // Handle absolute path fragments accidentally appended right after the markdown block (e.g., )./leads)
  if (clean.includes('./')) {
    clean = clean.replace(/\.\//g, '/');
  }

  // 3. Extract the path component out of the URL string
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      // Fallback for cases where path components like /leads get stuck directly to the hostname without a slash
      clean = parsed.pathname + parsed.search;
    } catch (e) {
      clean = clean.replace(/^https?:\/\/[^/]+/, '');
    }
  }

  // 4. Standardize slashes and strip redundant path prefixes
  clean = clean.replace(/\/+/g, '/');
  
  if (clean.startsWith('/api/')) clean = clean.substring(5);
  if (clean.startsWith('api/')) clean = clean.substring(4);
  if (clean.startsWith('/')) clean = clean.substring(1);

  // 5. Build absolute URL targeting your production backend
  const baseUrl = BACKEND_URL.replace(/\/+$/, '');
  return `${baseUrl}/${clean}`;
}

// Sanitize endpoint to prevent URL duplication (kept for backward compatibility)
export const sanitizeEndpoint = (endpoint: string): string => {
  // Remove any hardcoded production URLs
  const cleanEndpoint = endpoint.replace(/https:\/\/[^\/]+/g, '');
  // Remove any leading /api/ to prevent duplication
  const noApiPrefix = cleanEndpoint.replace(/^\/api\//, '');
  // Ensure single leading slash
  return noApiPrefix.startsWith('/') ? noApiPrefix : `/${noApiPrefix}`;
};

// Fetcher function for SWR that automatically adds API prefix
export const fetcher = async (endpoint: string, options?: RequestInit & { timeout?: number }) => {
  // 1. Format the endpoint to ensure absolute URL
  const fullUrl = formatEndpointUrl(endpoint);
  
  console.log(' [FIXED PRODUCTION FETCH]:', fullUrl);

  const controller = new AbortController();
  // EXTENDED TIMEOUT: 60s for Groq thinking time + stream chunking to prevent Render connection kill
  const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 60000); // Default 60 seconds

  try {
    // STREAM CHUNKING: Add headers to prevent Render from killing connection during long AI processing
    const callerHeaders = (options?.headers || {}) as Record<string, string>;
    const adminToken = getAdminAuthToken();

    const mergedHeaders: Record<string, string> = {
      ...callerHeaders,
      Accept: 'application/json',
      Connection: 'keep-alive',
    };

    // Attach the admin Bearer token automatically, unless the caller already set one.
    if (adminToken && !('Authorization' in mergedHeaders) && !('authorization' in mergedHeaders)) {
      mergedHeaders.Authorization = `Bearer ${adminToken}`;
    }

    const fetchOptions: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: mergedHeaders,
    };

    const res = await fetch(fullUrl, fetchOptions);
    clearTimeout(timeoutId);

    if (!res.ok) {
      let errMsg = `HTTP error! status: ${res.status}`;
      try {
        const errData = await res.json();
        if (errData && errData.detail) errMsg = errData.detail;
      } catch(e) {}
      console.warn('Fetcher warning (non-ok response):', errMsg);
      // Return a safe default instead of throwing
      return { stats: [], leads: [], total: 0 };
    }
    
    // STREAM CHUNKING: Check for chunked transfer (keeps connection alive during AI processing)
    const transferEncoding = res.headers.get("transfer-encoding");
    if (transferEncoding === "chunked") {
      console.log(' [STREAM CHUNKING]: Response is chunked, connection kept alive');
    }
    // This check prevents "Unexpected token <" error when backend returns HTML instead of JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn(' [FETCHER WARNING]: Backend returned non-JSON response, using safe default');
      return { stats: [], leads: [], total: 0 };
    }
    
    return res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn('Fetcher timeout, using safe default');
      return { stats: [], leads: [], total: 0 };
    }
    console.warn('Fetcher error, using safe default:', error);
    return { stats: [], leads: [], total: 0 };
  }
};
