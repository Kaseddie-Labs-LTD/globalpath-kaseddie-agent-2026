/**
 * GlobalPath Kaseddie Agent - Application Configuration
 * Central configuration for hardcoded constants and magic numbers
 */

export const APP_CONFIG = {
  // Contact Information
  HR_WHATSAPP: import.meta.env.VITE_HR_WHATSAPP || '+256784428821',
  ADMIN_PRIMARY: '+256784428821',
  
  // Recruitment Metrics
  FEES_BLOCKED_PER_LEAD: 2500,
  VERIFIED_PLACEMENT_RATE: 0.9,
  
  // Admin Dashboard
  EMERGENCY_SHOW_ALL: import.meta.env.VITE_EMERGENCY_SHOW_ALL === 'true',
  
  // HR Portal
  DEFAULT_LOCATION: 'Dubai, UAE',
  DEFAULT_SALARY: '$1,200 + Accommodation',
  
  // Search & Filtering
  MAX_FEED_ITEMS: 50,
  SEARCH_DEBOUNCE_MS: 300,
  
  // API Configuration
  API_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  
  // UI Configuration
  ANIMATION_DURATION_MS: 300,
  TOAST_DURATION_MS: 3000,
  
  // Validation
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 12,
  
  // Security
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  
  // Branding
  APP_NAME: 'GlobalPath Kaseddie Agent',
  APP_SIGNATURE: 'GlobalPath Kaseddie Agent',
} as const;

export type AppConfig = typeof APP_CONFIG;
