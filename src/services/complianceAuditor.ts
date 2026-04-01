import { Job, getJobLocationString } from '../../types';

export interface AuditResult {
  status: 'APPROVED' | 'REJECTED';
  reason: string;
  citation: string;
}

export class ComplianceAuditor {
  private readonly forbiddenKeywords = ['fee', 'visa cost', 'payment', 'charge', 'candidate pay', 'processing fees'];
  private readonly generalCitation = 'legal-kb/uganda-labor-rules.txt';

  public audit(job: Job): AuditResult {
    const description = (job.description || "").toLowerCase();
    const location = getJobLocationString(job.location).toLowerCase();
    const foundForbidden = this.forbiddenKeywords.filter(keyword => description.includes(keyword));

    // 1. Regional Audit: Luxembourg (EU Directive 2008/104/EC)
    if (location.includes('luxembourg')) {
      if (foundForbidden.length > 0) {
        return {
          status: 'REJECTED',
          reason: `Violation of EU Directive 2008/104/EC: Candidate-paid fees detected (${foundForbidden.join(', ')}).`,
          citation: 'EU Directive 2008/104/EC'
        };
      }
    }

    // 2. Regional Audit: UK (Conduct of Employment Agencies Regulations)
    if (location.includes('uk') || location.includes('united kingdom')) {
      if (foundForbidden.length > 0) {
        return {
          status: 'REJECTED',
          reason: `Violation of UK Conduct of Employment Agencies Regulations: Recruitment fees charged to candidates are illegal. Detected: ${foundForbidden.join(', ')}.`,
          citation: 'UK Conduct of Employment Agencies Regulations'
        };
      }
    }

    // 3. Regional Audit: Canada (Provincial Labor Standards)
    if (location.includes('canada')) {
      const canadaForbidden = ['processing fees', 'candidate-paid processing fees', ...this.forbiddenKeywords];
      const foundCanadaForbidden = canadaForbidden.filter(keyword => description.includes(keyword));
      
      if (foundCanadaForbidden.length > 0) {
        return {
          status: 'REJECTED',
          reason: `Violation of Provincial Labor Standards: Employers/Agents are prohibited from charging candidate-paid processing fees. Detected: ${foundCanadaForbidden.join(', ')}.`,
          citation: 'Canada Provincial Labor Standards'
        };
      }
    }

    // 4. General Audit (Default to Uganda Labor Rules for corridor safety)
    if (foundForbidden.length > 0) {
      return {
        status: 'REJECTED',
        reason: `Potential ethical violation: Found forbidden terms indicating candidate-paid costs: ${foundForbidden.join(', ')}`,
        citation: this.generalCitation
      };
    }

    return {
      status: 'APPROVED',
      reason: 'No candidate-paid costs detected in the job description. Compliant with regional labor standards.',
      citation: location.includes('luxembourg') ? 'EU Directive 2008/104/EC' : 
                (location.includes('uk') || location.includes('united kingdom')) ? 'UK Conduct of Employment Agencies Regulations' :
                location.includes('canada') ? 'Canada Provincial Labor Standards' : this.generalCitation
    };
  }
}

export const complianceAuditor = new ComplianceAuditor();
