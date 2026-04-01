
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Job, VerificationReport, SafetyReport, B2BPitch } from "../types";

// Correct implementation of helper with Gemini initialization
async function callGemini<T>(operation: (ai: GoogleGenAI) => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const apiKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || (process.env as any)?.API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      return await operation(ai);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || "";
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1500;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const enhanceJobDescription = async (job: Job): Promise<string> => {
  const prompt = `Act as a world-class recruitment specialist and GlobalPath Kaseddie Agent.
  TASK: Generate a highly detailed and engaging job description for:
  ROLE: ${job.title}
  COMPANY: ${job.company}
  LOCATION: ${job.location}
  SALARY: ${job.salary || 'Competitive'}
  
  STRICT MANDATE: 
  - Focus on highlighting the specific benefits of this role and the unique cultural, professional, and lifestyle aspects of working in ${job.location}.
  - Use a professional yet highly compelling and attractive tone to appeal to top-tier talent.
  - Explicitly integrate the following logistics: "Visa Sponsorship Provided", "Flight Ticket Included", and "Professional Accommodation Secured".
  - Return ONLY the final engaging text dossier without any introductory remarks.`;

  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text || job.description;
    });
  } catch (error) {
    return job.description;
  }
};

export const generateB2BPitch = async (job: Job, batchSize: number): Promise<B2BPitch> => {
  const prompt = `Act as GlobalPath Kaseddie Agent. 
  TASK: Generate a high-converting B2B Partnership Proposal for ${job.title} at ${job.company}.
  STRICT AUTHORITY POSITIONING:
  - Do NOT ask the employer how many workers they need.
  - State clearly: "We have a standing pool of 50+ Vetted Professionals (Verified Ready Workforce) ready for immediate deployment."
  - Emphasize that these candidates are pre-vetted via internal GAMCA/MRZ audits.
  - Mention Zero-Fee recruitment and the "AVA Trinity" compliance.
  - Tone: Authoritative, strategic, and solution-oriented.
  Output JSON format: { "hiringManager": "Name", "email": "Email", "proposal": "Full text here" }`;

  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hiringManager: { type: Type.STRING },
              email: { type: Type.STRING },
              proposal: { type: Type.STRING }
            },
            required: ['hiringManager', 'email', 'proposal']
          }
        }
      });
      return JSON.parse(response.text || '{}');
    });
  } catch (error) {
    return { 
      jobId: job.id, 
      hiringManager: "Lead Recruiter", 
      email: `hr@${job.company.toLowerCase().replace(/\s/g, '')}.com`, 
      proposal: `B2B Strategic Proposal: GlobalPath Kaseddie Agent has a standing pool of 50+ Vetted Professionals (Verified Ready Workforce) ready for immediate deployment for the ${job.title} vacancy at ${job.company}. Our Zero-Fee model and autonomous vetting protocols ensure immediate, compliant mobilization within the corridor.` 
    };
  }
};

export const generateRecruitmentVideo = async (prompt: string): Promise<string> => {
  return await callGemini(async (ai) => {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic recruitment advertisement for: ${prompt}. Show professional environments, diverse teams, and high-quality lifestyle in the target city. Vibrant, high-end, 4k look.`,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '16:9'
      }
    });
    
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    return downloadLink || '';
  });
};

export const searchAndMatchJobs = async (profileText: string, location: string): Promise<Job[]> => {
  const prompt = `Act as GlobalPath Kaseddie Agent. Mission: Autonomous Marathon Hunt for blue-collar and professional nodes.
  SEARCH QUERY: "${profileText}" roles in ${location}.
  MAPPING RULES:
  - Extract salary strings.
  - Audit text for the "AVA Trinity": Visa, Ticket, Accommodation.
  - Return JSON array of Job objects.`;

  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
          tools: [{ googleSearch: {} }], 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                location: { type: Type.STRING },
                salary: { type: Type.STRING },
                description: { type: Type.STRING },
                hasVisa: { type: Type.BOOLEAN },
                hasTicket: { type: Type.BOOLEAN },
                hasAccommodation: { type: Type.BOOLEAN },
                hasSponsorship: { type: Type.BOOLEAN },
                matchScore: { type: Type.NUMBER }
              },
              required: ['title', 'company', 'location']
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    });
  } catch (error) { 
    throw error; 
  }
};

export const summarizeJobRequirements = async (job: Job): Promise<string> => {
  const prompt = `Summarize the key requirements for the role "${job.title}" at "${job.company}" in "${job.location}". 
  Be concise (3–5 bullet points), focus on must-haves and compliance items (visa, ticket, accommodation). 
  Return plain text without markdown.`;
  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text || '';
    });
  } catch {
    const reqs = (job.requirements || []).slice(0, 5).join('; ');
    return reqs || 'Requirements available upon request.';
  }
};
export const generateFineTunedPitch = async (job: Job, currentDraft: string): Promise<string> => {
  const prompt = `As Kaseddie-Marathon-Hunter, rewrite this B2B pitch to emphasize our Zero-Fee Mandate, ethical recruitment from Uganda, and the specific cost-savings for ${job.company}. 
Role: ${job.title}, Location: ${job.location}.
Current Draft:
${currentDraft}

Make it authoritative and professional. Return plain text.`;
  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text || currentDraft;
    });
  } catch {
    return currentDraft;
  }
};
export const fetchGlobalPulseData = async (): Promise<Record<string, any>> => {
  const prompt = `Provide global pulse audit for migration corridors (ARE, QAT, DEU, CAN, POL, TUR). Return JSON.`;
  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || '{}');
    });
  } catch (error) {
    return {};
  }
};

export const verifyDocument = async (file: File, docType: string): Promise<VerificationReport> => {
  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolve) => {
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const prompt = `Verify this ${docType} for compliance. Return JSON.`;

  try {
    return await callGemini(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: file.type, data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ['verified', 'rejected', 'needs_review'] },
              details: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER },
              warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['status', 'details', 'confidence']
          }
        }
      });
      return { ...JSON.parse(response.text || '{}'), docType: docType as any };
    });
  } catch (error) {
    return { status: 'needs_review', details: ['Manual check needed'], docType: docType as any, confidence: 0, warnings: ['System timeout'] };
  }
};

export const analyzeJobSafety = async (job: Job): Promise<SafetyReport> => {
    const prompt = `Safety Audit for ${job.title} at ${job.company}. Return JSON.`;
    try {
        return await callGemini(async (ai) => {
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
            });
            const data = JSON.parse(response.text || '{}');
            return {
              jobId: job.id,
              safetyScore: data.safetyScore || 80,
              isDirectEmployer: data.isDirectEmployer ?? true,
              salaryFairness: data.salaryFairness || 'Fair',
              marketAverage: data.marketAverage || '$1,500',
              complianceFlags: data.complianceFlags || [],
              kafalaWarning: data.kafalaWarning || false,
              sponsorshipVerified: data.sponsorshipVerified ?? true,
              flightTicketProvided: data.flightTicketProvided ?? true,
              illegalFeeDetected: false,
              recommendation: data.recommendation || 'Apply'
            };
        });
    } catch (e) {
        return { jobId: job.id, safetyScore: 70, recommendation: 'Proceed with Caution' } as any;
    }
};
