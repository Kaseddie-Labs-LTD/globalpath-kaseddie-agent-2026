/**
 * Metadata Parser for Job Details
 * Splits job description blocks into structured sections:
 * - Job ID/Node ID
 * - Compliance Status (Ethical Handshake)
 * - Salary/Benefits
 * - Description (collapsed by default)
 */

export interface ParsedJobMetadata {
  jobId: string;
  nodeId: string;
  complianceStatus: 'verified' | 'flagged' | 'pending';
  salary?: string;
  benefits?: string[];
  description: string;
  isCollapsed: boolean;
}

export function parseJobMetadata(job: any): ParsedJobMetadata {
  const description = job.description || job.interests || '';
  
  // Extract Job ID from fingerprint or generate one
  const jobId = job.fingerprint || job.id || job.url || '';
  const nodeId = job.node || job.corridor || 'Global Corridor';
  
  // Determine compliance status
  let complianceStatus: 'verified' | 'flagged' | 'pending' = 'pending';
  if (job.complianceStatus === 'High Risk' || job.status === 'flagged' || job.recommendation === 'Non-Compliant') {
    complianceStatus = 'flagged';
  } else if (job.complianceStatus === 'Verified' || job.status === 'verified' || job.isVetted) {
    complianceStatus = 'verified';
  }
  
  // Extract salary
  const salary = job.salary || extractSalaryFromDescription(description);
  
  // Extract benefits
  const benefits = extractBenefitsFromDescription(description);
  
  // Clean description (remove metadata fields that were parsed)
  const cleanDescription = cleanDescriptionText(description);
  
  return {
    jobId,
    nodeId,
    complianceStatus,
    salary,
    benefits,
    description: cleanDescription,
    isCollapsed: true // Default to collapsed
  };
}

function extractSalaryFromDescription(text: string): string | undefined {
  const salaryPatterns = [
    /\$\d{1,3}(,\d{3})*\s*(monthly|yearly|annually|per month|per year)/i,
    /\$\d{1,3}(,\d{3})*\s*-\s*\$\d{1,3}(,\d{3})*\s*(monthly|yearly)/i,
    /(\d{1,3}(,\d{3})*)\s*(AED|USD|EUR)\s*(monthly|yearly)/i,
  ];
  
  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return undefined;
}

function extractBenefitsFromDescription(text: string): string[] {
  const benefits: string[] = [];
  const benefitKeywords = [
    'accommodation', 'housing', 'flight ticket', 'airfare', 'visa sponsorship',
    'health insurance', 'medical insurance', 'transport', 'transportation',
    'meal allowance', 'food allowance', 'annual leave', 'paid leave',
    'bonus', 'commission', 'overtime pay'
  ];
  
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of benefitKeywords) {
      if (lowerSentence.includes(keyword)) {
        benefits.push(sentence.trim());
        break;
      }
    }
  }
  
  return benefits;
}

function cleanDescriptionText(text: string): string {
  // Remove metadata-like patterns
  let cleaned = text
    .replace(/### \[OVERSIGHT REPORT\]/gi, '')
    .replace(/### \[TECHNICAL TELEMETRY\]/gi, '')
    .replace(/### \[RECRUITMENT BRIEFING\]/gi, '')
    .replace(/\*\*Node Identifier:\*\*/gi, '')
    .replace(/\*\*Regional Corridor:\*\*/gi, '')
    .replace(/\*\*Audit Summary:\*\*/gi, '')
    .replace(/\*\*Metadata:\*\*/gi, '')
    .replace(/Fingerprint:.*?`/gi, '')
    .replace(/Trace:.*?`/gi, '')
    .replace(/Status:.*?$/gm, '')
    .replace(/-\s+Fingerprint:.*?$/gm, '')
    .replace(/-\s+Trace:.*?$/gm, '')
    .trim();
  
  return cleaned;
}
