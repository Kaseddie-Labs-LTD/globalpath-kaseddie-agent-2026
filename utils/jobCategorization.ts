import { Job } from '../types';

export type JobSector = 'Logistics' | 'IT & Digital' | 'Manufacturing' | 'Healthcare' | 'Service & Domestic' | 'Other';
export type JobCategory = 'professional' | 'blue_collar' | 'service_domestic' | 'general';

// ─── Canonical keyword sets ────────────────────────────────────────────────
// Single source of truth used by both categorizeJob and categorizeJobForSector.
// Rules:
//   1. service_domestic checked FIRST so it is never shadowed by blue_collar.
//   2. 'it' removed from professional — too broad (matches "it involves...", etc.).
//      Use explicit phrases like 'it specialist', 'it manager', 'it support'.
//   3. 'ai' removed — matches "aid", "available", etc. Use 'ai engineer', 'ai specialist'.
//   4. blue_collar checked before professional to correctly bucket logistics/warehouse.

const SERVICE_DOMESTIC_KEYWORDS = [
  'cleaner', 'deep clean', 'housekeeper', 'housekeeping',
  'maid', 'housemaid', 'nanny', 'au pair',
  'domestic', 'janitor', 'caretaker',
  'caregiver', 'care home', 'care assistant', 'support worker',
  'home help', 'home carer',
];

const BLUE_COLLAR_KEYWORDS = [
  'driver', 'delivery driver', 'chauffeur', 'forklift',
  'delivery', 'courier',
  'warehouse', 'packing', 'picker', 'packer',
  'transport', 'logistics operator', 'freight',
  'helper', 'general helper', 'labourer', 'laborer',
  'merchandiser', 'shelf stacker', 'shelf',
  'butcher', 'butchery',
  'construction worker', 'site worker', 'tradesperson',
  'security guard', 'security officer',
  'chef', 'cook', 'kitchen hand', 'food prep',
];

const PROFESSIONAL_KEYWORDS = [
  // IT — explicit phrases only (never bare 'it')
  'software engineer', 'software developer', 'frontend', 'backend', 'fullstack',
  'web developer', 'mobile developer', 'devops', 'cloud engineer',
  'data scientist', 'data analyst', 'data engineer',
  'it specialist', 'it manager', 'it support', 'it consultant',
  'systems administrator', 'network engineer', 'cybersecurity', 'infosec',
  'ai engineer', 'ai specialist', 'machine learning',
  // Business & management
  'manager', 'director', 'executive', 'officer', 'coordinator',
  'consultant', 'analyst', 'associate', 'advisor',
  'procurement', 'supply chain', 'logistics manager', 'operations manager',
  'project manager', 'product manager', 'account manager',
  'business development', 'sales manager',
  // Finance & legal
  'accountant', 'auditor', 'finance', 'financial analyst', 'controller',
  'legal', 'lawyer', 'compliance officer',
  // Healthcare (professional tier)
  'nurse', 'registered nurse', 'doctor', 'physician', 'surgeon',
  'pharmacist', 'physiotherapist', 'radiologist',
  // Hospitality management
  'hotel manager', 'hospitality manager', 'events manager',
  // Known firms
  'pwc', 'deloitte', 'kpmg', 'ernst', 'mckinsey',
];

// ─── Unified categorizeJob ─────────────────────────────────────────────────
export const categorizeJob = (job: any): JobCategory => {
  const title       = (job.title        || job.positionName || '').toLowerCase();
  const description = (job.description  || job.interests    || '').toLowerCase();
  const company     = (job.company      || '').toLowerCase();

  // Check title first (most reliable signal), then description, then company name.
  const checkAll = (keywords: string[]) =>
    keywords.some(kw => title.includes(kw) || description.includes(kw) || company.includes(kw));
  const checkTitle = (keywords: string[]) =>
    keywords.some(kw => title.includes(kw));

  // 1. SERVICE & DOMESTIC — highest priority, checked first
  //    Domestic keywords in title are the most reliable signal.
  if (checkTitle(SERVICE_DOMESTIC_KEYWORDS)) return 'service_domestic';
  // Also catch description-level domestic signals (e.g. Apify leads where title = 'Unknown')
  if (checkAll(SERVICE_DOMESTIC_KEYWORDS)) return 'service_domestic';

  // 2. BLUE COLLAR — before professional to prevent 'logistics manager' matching blue collar
  if (checkTitle(BLUE_COLLAR_KEYWORDS)) return 'blue_collar';

  // 3. PROFESSIONAL
  if (checkAll(PROFESSIONAL_KEYWORDS)) return 'professional';

  // 4. BLUE COLLAR — description-level fallback (catches warehouse/driver in description only)
  if (checkAll(BLUE_COLLAR_KEYWORDS)) return 'blue_collar';

  // 5. Default — explicit 'general' rather than silently assuming blue_collar
  return 'general';
};

// ─── Sector classifier (for SearchSummary sector distribution display) ─────
export const categorizeJobForSector = (job: Job): JobSector => {
  const title       = (job.title       || '').toLowerCase();
  const description = (job.description || '').toLowerCase();
  const company     = (job.company     || '').toLowerCase();

  // Service & Domestic — checked before logistics
  const isDomesticCompany = ['the tidy troupe', 'authentic services', 'cleaning', 'domestic']
    .some(dc => company.includes(dc));

  if (
    isDomesticCompany ||
    SERVICE_DOMESTIC_KEYWORDS.some(kw => title.includes(kw) || description.includes(kw))
  ) return 'Service & Domestic';

  if (
    ['driver', 'warehouse', 'logistics', 'supply', 'forklift', 'delivery', 'freight', 'transport']
      .some(kw => title.includes(kw) || description.includes(kw))
  ) return 'Logistics';

  if (
    ['software', 'developer', 'frontend', 'backend', 'devops', 'it specialist', 'it manager',
     'cybersecurity', 'data scientist', 'cloud', 'digital', 'tech', 'engineer']
      .some(kw => title.includes(kw) || description.includes(kw))
  ) return 'IT & Digital';

  if (
    ['factory', 'production', 'manufacturing', 'operator', 'technician', 'machine']
      .some(kw => title.includes(kw) || description.includes(kw))
  ) return 'Manufacturing';

  if (
    ['nurse', 'care', 'health', 'medical', 'hospital', 'doctor', 'physician', 'pharmacist']
      .some(kw => title.includes(kw) || description.includes(kw))
  ) return 'Healthcare';

  return 'Other';
};
