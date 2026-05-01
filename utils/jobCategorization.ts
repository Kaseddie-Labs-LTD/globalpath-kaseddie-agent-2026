import { Job, getJobLocationString } from '../types';

export type JobSector = 'Logistics' | 'IT & Digital' | 'Manufacturing' | 'Healthcare' | 'Service & Domestic' | 'Other';

export const categorizeJob = (job: Job): JobSector => {
  const title = (job.title || '').toLowerCase();
  const description = (job.description || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  
  // K2.5 OMEGA: Explicit Service & Domestic company mapping
  const domesticCompanies = [
    'the tidy troupe',
    'authentic services', 
    'cleaning',
    'domestic'
  ];
  const isDomesticCompany = domesticCompanies.some(dc => company.includes(dc));
  
  // Service & Domestic detection (title/description OR company name)
  if (title.includes('cleaner') || title.includes('housekeeper') || title.includes('maid') || title.includes('nanny') || title.includes('domestic') || title.includes('janitor') ||
      description.includes('cleaner') || description.includes('housekeeper') || description.includes('maid') || description.includes('nanny') || description.includes('domestic') || description.includes('janitor') ||
      isDomesticCompany) {
    return 'Service & Domestic';
  }
  // Only deep-dive into Western Corridor (Poland/Canada/etc) or all if preferred
  // User specifically mentioned "those 100 Polish leads"
  else if (title.includes('driver') || title.includes('warehouse') || title.includes('logistics') || title.includes('supply') || title.includes('forklift') || title.includes('delivery') ||
      description.includes('driver') || description.includes('warehouse') || description.includes('logistics') || description.includes('supply') || description.includes('forklift') || description.includes('delivery')) {
    return 'Logistics';
  } else if (title.includes('software') || title.includes('developer') || title.includes('it') || title.includes('digital') || title.includes('tech') || title.includes('engineer') ||
             description.includes('software') || description.includes('developer') || description.includes('it') || description.includes('digital') || description.includes('tech') || description.includes('engineer')) {
    return 'IT & Digital';
  } else if (title.includes('factory') || title.includes('production') || title.includes('manufacturing') || title.includes('operator') || title.includes('technician') || title.includes('machine') ||
             description.includes('factory') || description.includes('production') || description.includes('manufacturing') || description.includes('operator') || description.includes('technician') || description.includes('machine')) {
    return 'Manufacturing';
  } else if (title.includes('nurse') || title.includes('care') || title.includes('health') || title.includes('medical') || title.includes('hospital') ||
             description.includes('nurse') || description.includes('care') || description.includes('health') || description.includes('medical') || description.includes('hospital')) {
    return 'Healthcare';
  } else {
    return 'Other';
  }
};
