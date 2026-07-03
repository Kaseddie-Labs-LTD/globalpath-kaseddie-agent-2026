import { Job } from '../types';

export type JobSector = 'Logistics' | 'IT & Digital' | 'Manufacturing' | 'Healthcare' | 'Service & Domestic' | 'Other';
export type JobCategory = 'professional' | 'blue_collar' | 'service_domestic';

export const categorizeJobForSector = (job: Job): JobSector => {
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

export const categorizeJob = (job: any): JobCategory => {
  const title = (job.title || '').toLowerCase();
  const description = (job.description || '').toLowerCase();
  const interests = (job.interests || '').toLowerCase();
  const text = `${title} ${description} ${interests}`;

  // 1. DOMESTIC & HOSPITALITY (The "Missing" Leads)
  if (
    text.includes('cleaner') || text.includes('maid') || 
    text.includes('housekeeping') || text.includes('chef') || 
    text.includes('cook') || text.includes('domestic') || 
    text.includes('caregiver') || text.includes('nanny') ||
    text.includes('housekeeper') || text.includes('care home') ||
    text.includes('care assistant') || text.includes('support worker')
  ) {
    return 'blue_collar';
  }

  // 2. LOGISTICS
  if (
    text.includes('driver') || text.includes('delivery') || 
    text.includes('transport') || text.includes('warehouse') ||
    text.includes('delivery driver') || text.includes('helper') ||
    text.includes('merchandiser') || text.includes('shelf')
  ) {
    return 'blue_collar';
  }

  // 3. IT & DIGITAL
  if (
    text.includes('it') || text.includes('software') ||
    text.includes('engineer') || text.includes('developer') || 
    text.includes('ai') || text.includes('it specialist') ||
    text.includes('cybersecurity') || text.includes('analyst') ||
    text.includes('consultant') || text.includes('manager') ||
    text.includes('associate') || text.includes('executive') ||
    text.includes('pwc') || text.includes('deloitte') || 
    text.includes('officer') || text.includes('procurement') ||
    text.includes('logistics manager') || text.includes('supply chain') ||
    text.includes('nurse') || text.includes('doctor') || 
    text.includes('physician') || text.includes('hospitality') ||
    text.includes('hotel') || text.includes('goodyear associate') ||
    text.includes('events management specialist')
  ) {
    return 'professional';
  }

  // 4. SERVICE & DOMESTIC (APPENDED - New Category)
  if (
    text.includes('cleaner') || text.includes('housekeeper') ||
    text.includes('maid') || text.includes('nanny') || 
    text.includes('domestic') || text.includes('janitor') ||
    text.includes('driver') || text.includes('delivery') || 
    text.includes('maintenance') || text.includes('caretaker')
  ) {
    return 'service_domestic';
  }

  // Default fallback - assume blue collar for missing data
  return 'blue_collar';
};
