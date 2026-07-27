// utils/salaryConverter.ts
import { categorizeJob } from './jobCategorization';

// Approximate exchange rates to USD
const EXCHANGE_RATES: Record<string, number> = {
  AED: 0.272, // UAE Dirham
  SAR: 0.267, // Saudi Riyal
  QAR: 0.275, // Qatari Riyal
  KWD: 3.250, // Kuwaiti Dinar
  BHD: 2.650, // Bahraini Dinar
  OMR: 2.600, // Omani Rial
  JOD: 1.410, // Jordanian Dinar
  USD: 1.000,
  USDT: 1.000,
  EUR: 1.080, // Euro
  GBP: 1.270, // British Pound
  CAD: 0.740, // Canadian Dollar
  AUD: 0.650, // Australian Dollar
  '$': 1.000,
  '€': 1.080,
  '£': 1.270,
};

/**
 * Tier 1: Mines raw text/description for buried salary figures and currency patterns
 */
export function mineSalaryFromText(text?: string): string | null {
  if (!text || typeof text !== 'string') return null;

  const patterns = [
    // Multi-currency with explicit rates/frequencies: e.g. "AED 5,000 - 8,000 / month", "5000 - 8000 AED"
    /(?:AED|SAR|QAR|KWD|BHD|OMR|JOD|USD|EUR|GBP|\$|€|£)\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:-|to)\s*(?:AED|SAR|QAR|KWD|BHD|OMR|JOD|USD|EUR|GBP|\$|€|£)?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*(?:\/|per)\s*(?:month|mo|year|yr|annum))?/i,
    /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:-|to)\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:AED|SAR|QAR|KWD|BHD|OMR|JOD|USD|EUR|GBP|\$|€|£)(?:\s*(?:\/|per)\s*(?:month|mo|year|yr|annum))?/i,
    /(?:AED|SAR|QAR|KWD|BHD|OMR|JOD|USD|EUR|GBP|\$|€|£)\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*(?:\/|per)\s*(?:month|mo|year|yr|annum))?/i,
    /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:AED|SAR|QAR|KWD|BHD|OMR|JOD|USD|EUR|GBP|\$|€|£)(?:\s*(?:\/|per)\s*(?:month|mo|year|yr|annum))?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Tier 2 Fallback: Calculates corridor and role-based benchmark estimated USD ranges
 */
export function getCorridorRoleBenchmarkUSD(corridorOrCountry?: string, jobTitleOrCategory?: string | any): string {
  const loc = (corridorOrCountry || '').toUpperCase();
  const isGCC = loc.includes('UAE') || loc.includes('DUBAI') || loc.includes('SAUDI') || 
                loc.includes('KSA') || loc.includes('QATAR') || loc.includes('KUWAIT') || 
                loc.includes('BAHRAIN') || loc.includes('OMAN') || loc.includes('JORDAN') || 
                loc.includes('GCC') || loc.includes('MIDDLE EAST');

  // Determine Category
  let category: string = 'general';
  if (typeof jobTitleOrCategory === 'string') {
    const lower = jobTitleOrCategory.toLowerCase();
    if (['blue_collar', 'professional', 'service_domestic', 'general'].includes(lower)) {
      category = lower;
    } else {
      category = categorizeJob({ title: jobTitleOrCategory });
    }
  } else if (jobTitleOrCategory && typeof jobTitleOrCategory === 'object') {
    category = categorizeJob(jobTitleOrCategory);
  }

  if (category === 'blue_collar') {
    return isGCC ? '$600 - $1,200 USD' : '$1,600 - $2,600 USD';
  }
  if (category === 'service_domestic') {
    return isGCC ? '$450 - $900 USD' : '$1,200 - $1,800 USD';
  }
  if (category === 'professional') {
    return isGCC ? '$2,500 - $4,500 USD' : '$4,500 - $8,500 USD';
  }

  return isGCC ? '$1,000 - $2,000 USD' : '$2,000 - $3,500 USD';
}

/**
 * Options for formatSalaryToUSD
 */
export interface FormatSalaryOptions {
  salaryText?: string;
  corridorOrCountry?: string;
  jobTitleOrCategory?: string | any;
  description?: string;
}

/**
 * Two-Tier Hybrid Salary Converter:
 * Tier 1: Deep Description Mining & Currency Normalization
 * Tier 2: Corridor & Role-Based Benchmark Fallback
 */
export function formatSalaryToUSD(
  salaryTextOrOptions?: string | FormatSalaryOptions,
  corridorOrCountry?: string,
  jobTitleOrCategory?: string | any,
  description?: string
): string {
  let salaryText = '';
  let corridor = corridorOrCountry;
  let roleCat = jobTitleOrCategory;
  let desc = description;

  if (salaryTextOrOptions && typeof salaryTextOrOptions === 'object') {
    salaryText = salaryTextOrOptions.salaryText || '';
    corridor = salaryTextOrOptions.corridorOrCountry || corridor;
    roleCat = salaryTextOrOptions.jobTitleOrCategory || roleCat;
    desc = salaryTextOrOptions.description || desc;
  } else if (typeof salaryTextOrOptions === 'string') {
    salaryText = salaryTextOrOptions;
  }

  // Tier 1 Step A: Check if salaryText itself contains numbers or currency
  let minedSalary = mineSalaryFromText(salaryText);

  // Tier 1 Step B: If salaryText is generic (e.g. "Competitive"), attempt deep description mining
  if (!minedSalary && desc) {
    minedSalary = mineSalaryFromText(desc);
  }

  const targetText = minedSalary || salaryText;
  const upperText = targetText.toUpperCase();

  // Detect currency code
  let detectedCurrency = '';
  for (const curr of Object.keys(EXCHANGE_RATES)) {
    if (upperText.includes(curr)) {
      detectedCurrency = curr;
      break;
    }
  }

  // Infer currency from location if not explicitly stated but numbers are present
  if (!detectedCurrency && corridor) {
    const loc = corridor.toUpperCase();
    if (loc.includes('UAE') || loc.includes('DUBAI')) detectedCurrency = 'AED';
    else if (loc.includes('SAUDI') || loc.includes('KSA')) detectedCurrency = 'SAR';
    else if (loc.includes('QATAR')) detectedCurrency = 'QAR';
    else if (loc.includes('KUWAIT')) detectedCurrency = 'KWD';
    else if (loc.includes('BAHRAIN')) detectedCurrency = 'BHD';
    else if (loc.includes('OMAN')) detectedCurrency = 'OMR';
    else if (loc.includes('JORDAN')) detectedCurrency = 'JOD';
    else if (loc.includes('GERMANY') || loc.includes('POLAND') || loc.includes('LUXEMBOURG') || loc.includes('EUROPE')) detectedCurrency = 'EUR';
    else if (loc.includes('UK') || loc.includes('LONDON')) detectedCurrency = 'GBP';
    else if (loc.includes('CANADA')) detectedCurrency = 'CAD';
    else if (loc.includes('USA')) detectedCurrency = 'USD';
  }

  if (!detectedCurrency) detectedCurrency = 'USD';

  const rate = EXCHANGE_RATES[detectedCurrency] || 1.0;
  const numbers = targetText.replace(/,/g, '').match(/\d+/g);

  // If no numbers could be parsed or mined, trigger Tier 2 Corridor & Role Benchmark Fallback!
  if (!numbers || numbers.length === 0) {
    return getCorridorRoleBenchmarkUSD(corridor, roleCat);
  }

  if (numbers.length === 1) {
    const val = parseInt(numbers[0], 10);
    // Ignore unrealistically small numbers (e.g., job ID digits parsed as salary)
    if (val < 100 && detectedCurrency !== 'KWD' && detectedCurrency !== 'BHD' && detectedCurrency !== 'OMR' && detectedCurrency !== 'JOD') {
      return getCorridorRoleBenchmarkUSD(corridor, roleCat);
    }
    const converted = Math.round(val * rate);
    return `$${converted.toLocaleString()} USD`;
  }

  // Range handling
  const minVal = parseInt(numbers[0], 10);
  const maxVal = parseInt(numbers[1], 10);

  if (minVal < 50 && maxVal < 50) {
    return getCorridorRoleBenchmarkUSD(corridor, roleCat);
  }

  const convertedMin = Math.round(minVal * rate);
  const convertedMax = Math.round(maxVal * rate);

  return `$${convertedMin.toLocaleString()} - $${convertedMax.toLocaleString()} USD`;
}
