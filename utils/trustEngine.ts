// Trust Intelligence Engine - Disruptor system for job safety validation
// Calculates trust scores for jobs in Poland, Dubai, and other corridors

export interface TrustScore {
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'CAUTION';
  flags: string[];
}

export const calculateTrustScore = (job: any): TrustScore => {
  let score = 50; // Base score
  const flags: string[] = [];

  // 1. Zero-Fee Compliance (+25)
  const description = (job.description || "").toLowerCase();
  const title = (job.title || "").toLowerCase();
  const fullText = `${description} ${title}`;
  
  if (fullText.includes("no fees") || 
      fullText.includes("employer pays") || 
      fullText.includes("free recruitment") || 
      fullText.includes("no charge") ||
      fullText.includes("zero fee")) {
    score += 25;
    flags.push("Zero-Fee Verified");
  }

  // 2. Verified Corridor (+15)
  const safeRegions = ['Luxembourg', 'Poland', 'Germany', 'Canada', 'UAE', 'Dubai', 'Qatar'];
  const location = getJobLocationString(job.location).toLowerCase();
  
  if (safeRegions.some(region => location.includes(region.toLowerCase()))) {
    score += 15;
    flags.push("High-Protection Corridor");
  }

  // 3. Known Entity Check (+10)
  if (job.company && job.company !== "Unknown" && job.company !== "Unknown Entity") {
    score += 10;
    flags.push("Established Entity");
  }

  // 4. Website/URL Validation (+5)
  if (job.website || job.url) {
    const website = (job.website || job.url || "").toLowerCase();
    if (website.includes('http') && website.includes('.')) {
      score += 5;
      flags.push("Valid Website");
    }
  }

  // 5. Contact Information (+5)
  if (job.email || job.phone) {
    score += 5;
    flags.push("Contact Available");
  }

  // 6. Red Flag Penalties (-40)
  const redFlags = [
    "processing fee",
    "payment required", 
    "visa fee",
    "ticket cost",
    "recruitment fee",
    "service charge",
    "administration fee",
    "advance payment"
  ];
  
  if (redFlags.some(flag => fullText.includes(flag))) {
    score -= 40;
    flags.push("PREDATORY PRICING DETECTED");
  }

  // 7. Suspicious Patterns (-20)
  const suspiciousPatterns = [
    "urgent hiring",
    "immediate start",
    "no experience needed",
    "work from home",
    "click here to apply",
    "send money"
  ];
  
  if (suspiciousPatterns.some(pattern => fullText.includes(pattern))) {
    score -= 20;
    flags.push("Suspicious Pattern");
  }

  // 8. Salary Transparency (+10)
  if (job.salary && job.salary !== "Competitive" && job.salary !== "Negotiable") {
    score += 10;
    flags.push("Salary Transparent");
  }

  // 9. Job Description Quality (+5)
  if (description.length > 100 && description.length < 2000) {
    score += 5;
    flags.push("Detailed Description");
  }

  // Calculate final score and level
  const finalScore = Math.min(Math.max(score, 0), 100);
  const level = finalScore > 80 ? 'HIGH' : finalScore > 50 ? 'MEDIUM' : 'CAUTION';

  return {
    score: finalScore,
    level,
    flags
  };
};

// Helper function to get location string (imported from types)
function getJobLocationString(location: any): string {
  if (!location) return "Global";
  
  if (typeof location === 'string') {
    return location;
  }
  
  if (typeof location === 'object' && location !== null) {
    return location.city || location.country || "Global";
  }
  
  return "Global";
}

// Trust Level Colors for UI
export const getTrustLevelColor = (level: TrustScore['level']): string => {
  switch (level) {
    case 'HIGH': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'MEDIUM': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'CAUTION': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

// Trust Score Badge Component Props
export interface TrustBadgeProps {
  score: TrustScore;
  size?: 'sm' | 'md' | 'lg';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ score, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border font-black uppercase tracking-wider ${sizeClasses[size]} ${getTrustLevelColor(score.level)}`}>
      <span className="font-black">{score.score}%</span>
      <span className="text-[10px]">{score.level}</span>
    </div>
  );
};
