import { Job } from '../types';

export const DEFAULT_AVG_FEE = 2500; // Default average placement fee in USD

export interface ComputedEthicalMetrics {
  totalLeads: number;
  blockedCount: number;
  blockedDollars: number;
  violationRate: number;
  totalPipelineDollars: number;
  avgFeePerLead: number;
  zeroFeeCount: number;
}

export function computeEthicalMetrics(
  leads: Job[] = [],
  totalDbCount?: number,
  defaultFee = DEFAULT_AVG_FEE
): ComputedEthicalMetrics {
  // Use DB total count if provided, fallback to array length
  const totalLeads = totalDbCount !== undefined && totalDbCount > 0 ? totalDbCount : leads.length;

  let blockedCount = 0;
  let blockedDollars = 0;
  let zeroFeeCount = 0;

  leads.forEach((lead) => {
    // Check for zero fee mandate
    if (lead.fee_blocked || lead.zero_fee) {
      zeroFeeCount += 1;
    }

    // Check lead flags for ethical fee violations
    const isViolation = lead.illegalFeeDetected || lead.status === 'flagged';

    if (isViolation) {
      blockedCount += 1;
      // Use actual detected fee if specified, otherwise fall back to baseline average
      // For now, we'll use the default average since we don't have a specific fee_amount field
      blockedDollars += defaultFee;
    }
  });

  const violationRate = totalLeads > 0 ? Math.round((blockedCount / totalLeads) * 100) : 0;
  const totalPipelineDollars = totalLeads * defaultFee;

  return {
    totalLeads,
    blockedCount,
    blockedDollars,
    violationRate,
    totalPipelineDollars,
    avgFeePerLead: defaultFee,
    zeroFeeCount,
  };
}
