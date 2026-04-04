
export interface JobLocation {
  city?: string;
  country?: string;
  formattedAddress?: string;
  fullAddress?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | JobLocation;
  country?: string;
  salary: string;
  salary_min: number;
  salary_max: number;
  is_commission_only: boolean;
  complianceStatus?: 'High Risk' | 'Verified' | 'Pending Review' | 'Requires Manual Enrichment';
  Contact_Email?: string;
  WhatsApp_Number?: string;
  Decision_Maker_Title?: string;
  company_domain?: string;
  matchScore: number;
  url: string;
  description: string;
  requirements: string[];
  source: string;
  dateFound: string;
  hasSponsorship: boolean;
  originalJobs?: Job[]; // For grouped job display
  isGrouped?: boolean; // For grouped job display
  hasFlightTicket: boolean;
  hasVisa: boolean;
  hasTicket: boolean;
  hasAccommodation: boolean;
  tier: 'PREMIER' | 'VERIFIED';
  hrContact?: string;
  employerEmail?: string;
  postedBy?: string;
  status?: 'pending_audit' | 'live' | 'flagged' | 'vetted' | 'vetting_pending';
  safetyScore?: number;
  recommendation?: string;
  isHighValue?: boolean;
  isVetted?: boolean;
  ticketIncluded?: boolean;
  accommodationSecured?: boolean;
  leadId?: string;
  gpLeadId?: string; // Professional lead tracking ID
  lat?: number;
  lng?: number;
  positionName?: string;
  sector?: 'Professional' | 'Blue-Collar' | 'Other';
  category?: 'blue_collar' | 'professional' | 'service_domestic';
  node?: string;
  corridor?: string;
}

export const getJobLocationString = (location: string | JobLocation | undefined): string => {
  if (!location) return "Global";
  if (typeof location === 'string') return location;
  
  const loc = location as JobLocation;
  if (loc.fullAddress) return loc.fullAddress;
  if (loc.formattedAddress) return loc.formattedAddress;
  
  // Safe property access with fallbacks
  const parts = [];
  if (loc.city) parts.push(loc.city);
  if (loc.country) parts.push(loc.country);
  if (loc.address) parts.push(loc.address); // Add address fallback
  if (loc.region) parts.push(loc.region); // Add region fallback
  
  return parts.length > 0 ? parts.join(", ") : "Global";
};

export interface VerificationReport {
  status: 'pending' | 'verified' | 'rejected' | 'needs_review';
  details: string[];
  docType: 'passport' | 'medical' | 'cv' | 'academics' | 'photo';
  confidence: number;
  warnings: string[];
}

export interface AgentLogEntry {
  id: string;
  timestamp: Date;
  step: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'thinking';
  signature?: string;
  actionable?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export type UserRole = 'CANDIDATE' | 'RECRUITER' | 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  userType: UserRole;
  targetRegions: string[];
  phone?: string;
  email?: string;
  documents: {
    passport: File | null;
    medical: File | null;
    cv: File | null;
    academics: File | null;
    photo: File | null;
  };
  verification: {
    passport: VerificationReport | null;
    medical: VerificationReport | null;
    cv: VerificationReport | null;
    academics: VerificationReport | null;
    photo: VerificationReport | null;
  };
  enhancedPhotoUrl?: string;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  UPLOADS = 'UPLOADS',
  MATCHES = 'MATCHES',
  CHAT = 'CHAT',
  VIDEO_GENERATOR = 'VIDEO_GENERATOR',
  WHATSAPP_BOT = 'WHATSAPP_BOT',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN = 'ADMIN',
  RECRUITER_LOGS = 'RECRUITER_LOGS',
  HR_PORTAL = 'HR_PORTAL',
  CORRIDOR_FEED = 'CORRIDOR_FEED',
  VENDOR_GATEKEEPER = 'VENDOR_GATEKEEPER',
  COMPLIANCE = 'COMPLIANCE'
}

export type AgentState = 
  | 'IDLE' 
  | 'SCANNING_JOBS' 
  | 'ANALYZING_VISA_RULES' 
  | 'HR_SCREENING' 
  | 'SELF_CORRECTING' 
  | 'AUDITING_FEES' 
  | 'VERIFYING_DOCS'
  | 'ENHANCING_PHOTO'
  | 'CORRIDOR_SYNCING'
  | 'SCANNING_CORRIDORS'
  | 'SECURE_VAULT_DEPOSIT'
  | 'SECURE_TRANSFER'
  | 'B2B_PITCHING'
  | 'VENDOR_AUDIT';

export type WorkflowStage = 'MATCHING' | 'DOC_CHECK' | 'VETTING' | 'VISA_SCREENING' | 'INTERVIEW_PREP' | 'OFFER';

export interface ApplicationWorkflow {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  candidateName: string;
  stage: WorkflowStage;
  progress: number;
  lastUpdate: Date;
  status: 'active' | 'paused' | 'completed' | 'alert';
  logs: string[];
}

export interface SafetyReport {
  jobId: string;
  safetyScore: number;
  isDirectEmployer: boolean;
  salaryFairness: 'Low' | 'Fair' | 'High' | 'Unknown';
  marketAverage: string;
  complianceFlags: string[];
  kafalaWarning: boolean;
  sponsorshipVerified: boolean;
  flightTicketProvided: boolean;
  illegalFeeDetected: boolean;
  recommendation: 'Apply' | 'Proceed with Caution' | 'Avoid' | 'Non-Compliant';
}

export interface RecruitmentBatch {
  id: string;
  corridor: string;
  size: number;
  verifiedCount: number;
  status: 'processing' | 'verified' | 'pending';
  priority: 'high' | 'normal';
}

export interface VendorPortal {
  id: string;
  name: string;
  region: string;
  status: 'Registered' | 'Pending' | 'Action Required' | 'Not Started';
  url: string;
  lastLogin?: string;
}

export interface OfferLetter {
  id?: string;
  candidateId: string;
  jobId?: string;
  status: 'sent' | 'accepted' | 'rejected' | 'pending';
  dateSent?: string;
}

export interface B2BPitch {
  jobId: string;
  hiringManager: string;
  email: string;
  proposal: string;
}
