import { Job, SafetyReport, B2BPitch, VerificationReport } from "../types";
import { doJSONCompletion, doTextCompletion } from "./doClient";
import * as gemini from "./gemini";
import { API_BASE } from "../constants/api";

const brandBlue = '#031B4E';
const brandGold = '#EAB308';

export const KASEDDIE_KNOWLEDGE_BASE = {
  mission: "GlobalPath's mission is to provide elite, ethical recruitment solutions, connecting top-tier Ugandan talent with global opportunities through a Zero-Fee mandate and autonomous vetting protocols.",
  vettingStandards: "Our Stage 4 Vetting includes internal GAMCA/MRZ audits, technical competency assessments, and 'AVA Trinity' (Accommodation, Visa, Airfare) compliance verification.",
  outreachTone: "Elite, authoritative, strategic, and solution-oriented. We position ourselves as partners, not just agencies.",
  talentPool: "Our standing pool consists of 500+ verified Ugandan professionals, pre-vetted and ready for immediate deployment across healthcare, engineering, logistics, and hospitality."
};

function hasDOCreds() {
  const a = (import.meta as any)?.env?.VITE_DO_AGENT_ENDPOINT;
  const b = (import.meta as any)?.env?.VITE_DO_AGENT_ACCESS_KEY;
  const c = (import.meta as any)?.env?.VITE_DO_API_KEY;
  return !!(a && b) || !!c;
}

export async function enhanceJobDescription(job: Job): Promise<string> {
  if (!hasDOCreds()) return gemini.enhanceJobDescription(job);
  const system = 'You are Kaseddie, a recruitment specialist for GlobalPath. Write compelling, compliant job descriptions.';
  const user = [
    `Role: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Salary: ${job.salary || 'Competitive'}`,
    `Mandates: Emphasize Visa Sponsorship, Flight Ticket, Accommodation.`,
    `Return plain text only.`,
  ].join('\n');
  try {
    const res = await doTextCompletion(system, user);
    return res || job.description;
  } catch {
    return gemini.enhanceJobDescription(job);
  }
}

export async function generateB2BPitch(job: Job, batchSize: number): Promise<B2BPitch> {
  if (!hasDOCreds()) return gemini.generateB2BPitch(job, batchSize);
  const system = `You are Kaseddie Hunter, a senior recruiter at GlobalPath. 
  CONTEXT:
  - Mission: ${KASEDDIE_KNOWLEDGE_BASE.mission}
  - Vetting: ${KASEDDIE_KNOWLEDGE_BASE.vettingStandards}
  - Tone: ${KASEDDIE_KNOWLEDGE_BASE.outreachTone}
  - Talent: ${KASEDDIE_KNOWLEDGE_BASE.talentPool}
  Maintain an elite, authoritative tone. Emphasize our Ugandan HQ, Zero-Fee mandate, ethical recruitment, and Stage 4 vetting.`;
  const user = [
    `Return JSON with keys: hiringManager, email, proposal.`,
    `Write a professional B2B recruitment proposal for ${job.company}.`,
    `They are hiring for ${job.title} at ${job.salary || 'Competitive Salary'}.`,
    `Reference current 2026 market demands in their region (${job.location || 'target corridor'}) and explain why GlobalPath's Stage 4 Vetted Ugandan talent is the most cost-effective and ethical solution.`,
    `Emphasize our Ugandan HQ and vetted candidates.`,
    `Also note standing pool of ${batchSize || 500}+ verified professionals ready now.`,
    `Keep hiringManager and email concise; proposal must be plain text.`,
    `Ensure the proposal ends with contact lines:`,
    `WhatsApp: +256 784428821 / +256 756824859`,
    `Email: hr@globalpathkaseddieagent.com`,
  ].join('\n');
  try {
    const obj = await doJSONCompletion<any>(system, user);
    const proposal: string = (obj.proposal || '').trim();
    const withContacts = /\bWhatsApp:/i.test(proposal)
      ? proposal
      : [proposal, '', 'WhatsApp: +256 784428821 / +256 756824859', 'Email: hr@globalpathkaseddieagent.com'].join('\n');
    return {
      jobId: job.id,
      hiringManager: obj.hiringManager || 'Hiring Manager',
      email: obj.email || job.Contact_Email || job.employerEmail || undefined,
      proposal: withContacts,
    };
  } catch {
    const fb = await gemini.generateB2BPitch(job, batchSize);
    return { ...fb, email: job.Contact_Email || job.employerEmail || undefined, proposal: /\bWhatsApp:/i.test(fb.proposal) ? fb.proposal : [fb.proposal, '', 'WhatsApp: +256 784428821 / +256 756824859', 'Email: hr@globalpathkaseddieagent.com'].join('\n') };
  }
}

export async function generateJobInsight(job: Job): Promise<string> {
  const system = `You are Kaseddie Hunter at GlobalPath. 
  CONTEXT:
  - Mission: ${KASEDDIE_KNOWLEDGE_BASE.mission}
  - Vetting: ${KASEDDIE_KNOWLEDGE_BASE.vettingStandards}
  - Talent: ${KASEDDIE_KNOWLEDGE_BASE.talentPool}
  Write a 2-sentence "Match Insight" for the HR Admin. Explicitly state why this specific role matches the Kaseddie talent pool (e.g., specific skill alignment, corridor demand, or vetting readiness).`;
  const user = `Job: ${job.title} at ${job.company} in ${job.location}. Explain why this is a match for our Uganda-to-Global pipeline.`;
  
  try {
    if (hasDOCreds()) {
      return await doTextCompletion(system, user);
    }
    // Fallback if no DO creds
    return `This ${job.title} role aligns perfectly with our ${job.category === 'professional' ? 'Professional' : 'Blue-Collar'} talent pool in Uganda. Our Stage 4 Vetting ensures immediate readiness for ${job.location}'s high-demand corridor.`;
  } catch {
    return `Ideal match for GlobalPath's vetted Ugandan workforce. Ready for immediate deployment to ${job.location}.`;
  }
}

export async function generateB2BPitchText(job: Job): Promise<string> {
  const title = String(job.title || '').trim();
  const company = String(job.company || '').trim();
  const location = String(job.location || '').trim();
  
  // Try API first, fallback to local generation
  try {
    const response = await fetch(`${API_BASE}/api/generate-proposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_title: title,        // Backend expects 'job_title'
        company: company,
        location: location,
        category: job.category,
        salary: job.salary
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.proposal) {
        return data.proposal;
      }
    }
  } catch (error) {
    console.warn('API generate-proposal failed, using fallback:', error);
  }
  
  // Fallback to local generation
  if (!hasDOCreds()) {
    const fb = await gemini.generateFineTunedPitch(job, '');
    const withContacts = /\bWhatsApp:/i.test(fb)
      ? fb
      : [fb, '', 'WhatsApp: +256 784428821 / +256 756824859', 'Email: hr@globalpathkaseddieagent.com'].join('\n');
    return withContacts;
  }
  
  const system = 'You are Kaseddie Hunter at GlobalPath. Write high-conversion B2B proposals in a professional, ethical tone focused on our vetted Ugandan workforce.';
  const user = [
    `Access the GlobalPath Knowledge Base to draft a B2B proposal for ${title}.`,
    `Write a high-conversion B2B proposal for ${title} at ${company}.`,
    `Location: ${location || 'Target Corridor'}.`,
    `Use the GlobalPath tone: professional, ethical, focused on our vetted Ugandan workforce.`,
    `Include our contact lines at the end:`,
    `WhatsApp: +256 784428821 / +256 756824859`,
    `Email: hr@globalpathkaseddieagent.com`,
    `Return plain text only.`,
  ].join('\n');
  const text = await doTextCompletion(system, user);
  return /\bWhatsApp:/i.test(text) ? text : [text, '', 'WhatsApp: +256 784428821 / +256 756824859', 'Email: hr@globalpathkaseddieagent.com'].join('\n');
}

export async function searchAndMatchJobs(profileText: string, location: string): Promise<Job[]> {
  if (!hasDOCreds()) return gemini.searchAndMatchJobs(profileText, location);
  const system = 'You are Kaseddie performing compliant job mapping. Return an array of Job objects as JSON.';
  const user = [
    `Search query: "${profileText}" in ${location}.`,
    `Fields: id,title,company,location,salary,description,hasVisa,hasTicket,hasAccommodation,hasSponsorship,matchScore.`,
  ].join('\n');
  try {
    const arr = await doJSONCompletion<Job[]>(system, user);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return gemini.searchAndMatchJobs(profileText, location);
  }
}

export async function summarizeJobRequirements(job: Job): Promise<string> {
  if (!hasDOCreds()) return gemini.summarizeJobRequirements(job);
  const system = 'You summarize must-have requirements briefly for candidates.';
  const user = `Summarize 3–5 key requirements for "${job.title}" at "${job.company}" in "${job.location}". Mention visa/ticket/accommodation if applicable.`;
  try {
    return await doTextCompletion(system, user);
  } catch {
    return gemini.summarizeJobRequirements(job);
  }
}

export async function fetchGlobalPulseData(): Promise<Record<string, any>> {
  if (!hasDOCreds()) return gemini.fetchGlobalPulseData();
  const system = 'You provide policy pulse data for migration corridors as JSON keyed by ISO3.';
  const user = 'Provide updated worker protection and visa approval stats for ARE,QAT,DEU,CAN,POL,TUR as JSON with fields: safety, visaApproval, protectionRating, status, notes.';
  try {
    return await doJSONCompletion<Record<string, any>>(system, user);
  } catch {
    return gemini.fetchGlobalPulseData();
  }
}

export async function verifyDocument(file: File, docType: string): Promise<VerificationReport> {
  return gemini.verifyDocument(file, docType);
}

export async function analyzeJobSafety(job: Job): Promise<SafetyReport> {
  if (!hasDOCreds()) return gemini.analyzeJobSafety(job);
  const system = 'You audit job safety and compliance and return a JSON object.';
  const user = `Audit ${job.title} at ${job.company}. Include safetyScore,isDirectEmployer,salaryFairness,marketAverage,complianceFlags,kafalaWarning,sponsorshipVerified,flightTicketProvided,illegalFeeDetected,recommendation.`;
  try {
    const obj = await doJSONCompletion<any>(system, user);
    return {
      jobId: job.id,
      safetyScore: obj.safetyScore ?? 80,
      isDirectEmployer: obj.isDirectEmployer ?? true,
      salaryFairness: obj.salaryFairness || 'Fair',
      marketAverage: obj.marketAverage || '',
      complianceFlags: obj.complianceFlags || [],
      kafalaWarning: obj.kafalaWarning ?? false,
      sponsorshipVerified: obj.sponsorshipVerified ?? true,
      flightTicketProvided: obj.flightTicketProvided ?? true,
      illegalFeeDetected: obj.illegalFeeDetected ?? false,
      recommendation: obj.recommendation || 'Apply',
    };
  } catch {
    return gemini.analyzeJobSafety(job);
  }
}

export async function refinePitch(job: Job, currentDraft: string): Promise<string> {
  console.log('🔍 [REFINE PITCH DEBUG]: Starting refinement', {
    jobId: job.id,
    jobTitle: job.title,
    jobCompany: job.company,
    currentDraftLength: currentDraft.length
  });
  
  try {
    // POST to Python backend for pitch refinement using new agent chat endpoint
    const url = '/api/agent/chat';
    console.log('🌐 [REFINE PITCH DEBUG]: Calling URL:', url);
    
    // Create context message with job details for Llama-3.3
    const jobContext = `Job Title: ${job.title || ''}
Company: ${job.company || ''}
Location: ${job.location || ''}
Current Draft: ${currentDraft}

Please refine this B2B pitch for the job above. Make it more compelling, professional, and compliant with GlobalPath's zero-fee recruitment standards.`;
    
    const requestBody = {
      message: jobContext
    };
    console.log('📤 [REFINE PITCH DEBUG]: Request body:', requestBody);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📡 [REFINE PITCH DEBUG]: Response status:', response.status);
    
    if (response.ok) {
      // Handle streaming response from new agent chat endpoint
      const reader = response.body?.getReader();
      if (reader) {
        let refinedText = '';
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          refinedText += chunk;
        }
        
        console.log('✅ [REFINE PITCH DEBUG]: Streaming complete! Response length:', refinedText.length);
        console.log('📝 [REFINE PITCH DEBUG]: Refined text preview:', refinedText.substring(0, 200) + '...');
        return refinedText || currentDraft;
      } else {
        // Fallback for non-streaming response
        const result = await response.json();
        console.log('✅ [REFINE PITCH DEBUG]: Success! Response:', result);
        const refinedText = result.reply || currentDraft;
        console.log('📝 [REFINE PITCH DEBUG]: Refined text length:', refinedText.length);
        return refinedText;
      }
    } else {
      console.log('❌ [REFINE PITCH DEBUG]: Request failed with status:', response.status);
      const errorText = await response.text();
      console.log('❌ [REFINE PITCH DEBUG]: Error response:', errorText);
    }
  } catch (error) {
    console.warn('🔥 [REFINE PITCH DEBUG]: Exception caught:', error);
    console.warn('🔥 [REFINE PITCH DEBUG]: Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
  
  // Fallback to original logic if backend fails
  console.log('🔄 [REFINE PITCH DEBUG]: Using fallback logic');
  if (!hasDOCreds()) return gemini.generateFineTunedPitch(job, currentDraft);
  const system = 'You refine B2B pitches for GlobalPath emphasizing Zero-Fee and cost savings.';
  const user = [
    `Role: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Draft:`,
    currentDraft,
    `Return improved plain text.`,
  ].join('\n');
  try {
    const result = await doTextCompletion(system, user);
    console.log('✅ [REFINE PITCH DEBUG]: Fallback success, result length:', result.length);
    return result;
  } catch (fallbackError) {
    console.warn('❌ [REFINE PITCH DEBUG]: Fallback also failed:', fallbackError);
    console.log('🔄 [REFINE PITCH DEBUG]: Using final fallback to Gemini');
    return gemini.generateFineTunedPitch(job, currentDraft);
  }
}

export async function generateRecruitmentVideo(prompt: string): Promise<string> {
  const script = hasDOCreds()
    ? await doTextCompletion(
        'You generate a short 3-line slogan for recruitment promos.',
        `Create 3 short lines for a promo about: ${prompt}.`,
      ).catch(() => '') 
    : '';
  const lines = (script || 'GlobalPath Opportunities\nVerified Visa Ticket Accommodation\nApply Today').split('\n').slice(0, 3);
  const width = 1280;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const stream = (canvas as any).captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data && chunks.push(e.data);
  const done = new Promise<string>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      resolve(url);
    };
  });
  let frame = 0;
  const duration = 5;
  const totalFrames = 30 * duration;
  function drawFrame() {
    const t = frame / totalFrames;
    ctx.fillStyle = brandBlue;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = brandGold;
    ctx.fillRect(0, height - 8, width, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lines[0] || '', width / 2, height / 2 - 40);
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#EAB308';
    ctx.fillText(lines[1] || '', width / 2, height / 2 + 20);
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lines[2] || '', width / 2, height / 2 + 70);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = brandGold;
    const radius = 200 + Math.sin(t * Math.PI * 2) * 40;
    ctx.beginPath();
    ctx.arc(width - 220, 220, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    frame++;
  }
  // Draw at least one frame before recording to avoid blank blobs
  drawFrame();
  function animate() {
    drawFrame();
    if (frame <= totalFrames) {
      requestAnimationFrame(animate);
    } else {
      recorder.stop();
    }
  }
  requestAnimationFrame(() => {
    recorder.start();
    animate();
  });
  return await done;
}

export async function generateCorridorB2BProposal(job: Job, corridor: string): Promise<string> {
  if (!hasDOCreds()) {
    const draft = await gemini.generateFineTunedPitch(job, '');
    return draft;
  }
  const system = 'You are Kaseddie Hunter at GlobalPath. Use your DigitalOcean Chatbot knowledge base to write high-conversion B2B proposals in an elite tone. Emphasize our Ugandan HQ and vetted candidates.';
  const user = [
    `You are Kaseddie Hunter. Write a proposal for ${job.title} at ${job.company}.`,
    `Use the real-world market conditions for ${corridor} in 2026.`,
    `Emphasize our Ugandan HQ and vetted candidates.`,
    `Address the specific hiring needs for ${job.title} at ${job.company} at ${job.salary || 'Competitive Salary'}.`,
    `Focus on Stage 4 Vetting and Ethical Recruitment from Uganda.`,
    `If specific market details are uncertain, emphasize the quality of GlobalPath's vetting process.`,
    `Return plain text only and end with:`,
    `WhatsApp: +256 784428821 / +256 756824859`,
    `Email: hr@globalpathkaseddieagent.com`,
  ].join('\n');
  const text = await doTextCompletion(system, user);
  return /\bWhatsApp:/i.test(text) ? text : [text, '', 'WhatsApp: +256 784428821 / +256 756824859', 'Email: hr@globalpathkaseddieagent.com'].join('\n');
}
