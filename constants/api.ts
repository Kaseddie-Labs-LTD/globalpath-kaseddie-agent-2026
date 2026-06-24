// API Base URL configuration
const VITE_API_URL = (import.meta as any)?.env?.VITE_API_URL as string | undefined;

export const BACKEND_URL = VITE_API_URL
  ? VITE_API_URL.replace(/\/+$/, '')
  : '/api';

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
export const fetcher = async (url: string, options?: RequestInit & { timeout?: number }) => {
  // 1. If the URL already starts with /api, remove it so we don't double up
  const path = url.startsWith('/api') ? url.replace('/api', '') : url;
  
  // 2. Ensure path starts with a single slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // 3. Final URL construction
  const fullUrl = `${BACKEND_URL}${cleanPath}`;
  
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
      throw new Error(errMsg);
    }
    
    // STREAM CHUNKING: Check for chunked transfer (keeps connection alive during AI processing)
    const transferEncoding = res.headers.get("transfer-encoding");
    if (transferEncoding === "chunked") {
      console.log(' [STREAM CHUNKING]: Response is chunked, connection kept alive');
    }
    // This check prevents "Unexpected token <" error when backend returns HTML instead of JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error(' [FETCHER ERROR]: Backend returned HTML instead of JSON:', contentType);
      throw new Error("Oops! Backend returned HTML instead of JSON. Check your API paths.");
    }
    
    return res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Connection Timeout: The server took too long to respond.");
    }
    throw error;
  }
};
