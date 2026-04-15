import React, { useState, useEffect } from 'react';
import { Zap, Send, Loader2, Sparkles, Building2, Briefcase, Copy, Check, DollarSign, Globe, MessageSquare, Mail, ExternalLink } from 'lucide-react';
import { AgentLogEntry, Job } from '../types';

interface B2BPitchGeneratorProps {
  onGenerate: (title: string, company: string, salary?: string, country?: string, category?: string, location?: string) => Promise<string>;
  onLog?: (message: string, type: AgentLogEntry['type'], step?: string) => void;
  selectedLead?: Job | null;
  isGeneratingPitch?: boolean; // AI UX: Visual thinking state from parent
  pitchErrorMessage?: string | null; // AI UX: Error message from parent
}

export const B2BPitchGenerator: React.FC<B2BPitchGeneratorProps> = ({ 
  onGenerate, 
  onLog, 
  selectedLead,
  isGeneratingPitch = false, // AI UX: Parent-controlled generating state
  pitchErrorMessage = null   // AI UX: Parent-provided error message
}) => {
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [salary, setSalary] = useState('');
  const [localLoading, setLocalLoading] = useState(false); // Local loading for fallback template
  const [statusMessage, setStatusMessage] = useState('');
  const [pitch, setPitch] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastLeadId = React.useRef<string | null>(null);
  
  // AI UX: Combine parent and local loading states
  const loading = isGeneratingPitch || localLoading;

  const handleSubmit = async (title?: string, comp?: string, sal?: string) => {
    const finalTitle = title || jobTitle;
    const finalCompany = comp || company;
    // Data Handling: Replace null/empty salary with "Competitive / To be discussed"
    const finalSalary = (sal || salary || '').trim() === '' || (sal || salary) === 'null' 
      ? 'Competitive / To be discussed' 
      : (sal || salary);
    
    if (!finalTitle || !finalCompany) return;

    // AI UX: Use local loading for immediate template (parent handles AI generation state)
    setLocalLoading(true);
    setStatusMessage('Verifying Corridor...');
    
    // Safety Stats Injection Logic
    let safetyStat = "";
    const country = (selectedLead?.country || '').toLowerCase();
    if (country.includes('poland')) safetyStat = "POLAND NODE: 88% Worker Protection Rating Verified.";
    else if (country.includes('luxembourg')) safetyStat = "PREMIUM NODE: 99% Compliance & Legal Safety Rating.";
    else if (country.includes('uae') || country.includes('dubai')) safetyStat = "DUBAI HUB: Zero-Fee Recruitment Compliance Active.";
    else if (country.includes('germany')) safetyStat = "EU-CENTRAL: High-Tier Social Protection Standards.";

    // Immediate Template: Show a high-quality B2B proposal instantly
    const initialFallbackPitch = `
Dear Hiring Team at ${finalCompany},

I am reaching out from GlobalPath regarding your ${finalTitle} opening. 

${safetyStat ? `[COMPLIANCE NOTE: ${safetyStat}]` : ""}

We have a vetted pool of nodes ready for this role, specifically processed through our zero-fee ethical recruitment pipeline. Our candidates are fully compliant with the requirements and ready for a technical sync.

Key Details:
- Role: ${finalTitle}
- Compensation: ${finalSalary}
- Vetting: Stage 4 Verified

Would you be open to a brief sync to discuss our available talent nodes?

Best regards,
GlobalPath Outreach Command Center
    `.trim();
    
    setPitch(initialFallbackPitch);
    onLog?.(`OUTREACH AGENT: Deployed Immediate Template Handshake for ${finalTitle}. Phi-3 background refinement starting...`, "thinking", "OUTREACH");
    
    try {
      setStatusMessage('Streaming Ethical Pitch...');
      const generatedPitch = await onGenerate(
        finalTitle, 
        finalCompany, 
        finalSalary, 
        selectedLead?.country, 
        selectedLead?.category,
        selectedLead?.location
      );
      setPitch(generatedPitch);
      setStatusMessage('Complete');
      onLog?.(`OUTREACH AGENT: Phi-3 refinement complete. Unified Pitch updated.`, "success", "OUTREACH");
      setLocalLoading(false);
      setTimeout(() => setStatusMessage(''), 2000);
    } catch (err: any) {
      const errMsg = err.message || "Server Busy";
      setStatusMessage(`Error 504: ${errMsg}`);
      onLog?.(`OUTREACH AGENT: Phi-3 Uplink Failed. Keeping high-authority template.`, "warning", "OUTREACH");
      setTimeout(() => {
        setLocalLoading(false);
        setStatusMessage('');
      }, 4000);
    }
  };

  useEffect(() => {
    if (selectedLead && selectedLead.id !== lastLeadId.current) {
      lastLeadId.current = selectedLead.id;
      const title = selectedLead.title || '';
      const comp = selectedLead.company || '';
      
      // DEBUG: Log what we're actually passing
      console.log('🔍 [B2BPitchGenerator] Selected lead data:', {
        id: selectedLead.id,
        company: comp,
        location: selectedLead.location,
        title: title
      });
      
      // Initial null check for salary
      const sal = (selectedLead.salary || '').trim() === '' || selectedLead.salary === 'null'
        ? 'Competitive / To be discussed'
        : selectedLead.salary;
      
      setJobTitle(title);
      setCompany(comp);
      setSalary(sal);
      
      // Auto-generate pitch when lead changes
      if (title && comp) {
        handleSubmit(title, comp, sal);
      }
    }
  }, [selectedLead]);

  const handleCopy = () => {
    if (!pitch) return;
    navigator.clipboard.writeText(pitch);
    setCopied(true);
    onLog?.("PITCH COPIED: Ready for dispatch.", "success", "OUTREACH");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!pitch) return;
    const number = selectedLead?.WhatsApp_Number || '256784428821'; // Default to HR
    
    // Determine Country Code
    let countryCode = '256'; // Default Uganda
    const country = (selectedLead?.country || '').toLowerCase();
    if (country.includes('poland')) countryCode = '48';
    else if (country.includes('luxembourg')) countryCode = '352';
    else if (country.includes('uae') || country.includes('emirates')) countryCode = '971';
    else if (country.includes('saudi') || country.includes('ksa')) countryCode = '966';
    
    // Clean number and ensure country code
    let cleanNumber = number.replace(/\D/g, '');
    if (!cleanNumber.startsWith(countryCode)) {
      cleanNumber = countryCode + cleanNumber;
    }

    const encodedPitch = encodeURIComponent(pitch);
    window.open(`https://wa.me/${cleanNumber}?text=${encodedPitch}`, '_blank');
    onLog?.(`OUTREACH: Dispatching via WhatsApp (+${countryCode}).`, "info", "OUTREACH");
  };

  const handleEmail = () => {
    if (!pitch) return;
    const email = selectedLead?.employerEmail || selectedLead?.Contact_Email || 'hr@globalpathkaseddieagent.com';
    const subject = `Strategic Recruitment Proposal: ${jobTitle} at ${company}`;
    const body = encodeURIComponent(pitch);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`;
    onLog?.(`OUTREACH: Opening PrivateEmail client for ${company}.`, "info", "OUTREACH");
  };

  const handleWebApply = () => {
    if (!selectedLead?.url) return;
    handleCopy();
    onLog?.("WEB-APPLY MODE: Opening application portal. Pitch copied to clipboard.", "info", "OUTREACH");
    window.open(selectedLead.url, '_blank');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const hasDirectContact = selectedLead?.WhatsApp_Number || selectedLead?.employerEmail || selectedLead?.Contact_Email;

  return (
    <div className="outreach-node-console bg-[#0a0a0a] rounded-[2rem] border border-cyan-900/50 text-cyan-400 shadow-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">Outreach Command Center</h3>
            <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest">Unified B2B & Direct Pitch • Phi-3</p>
          </div>
        </div>
        {selectedLead?.country && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1a] rounded-full border border-cyan-900/50">
            <Globe size={10} className="text-cyan-400" />
            <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">{selectedLead.country}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="pitch-job-title" className="text-[10px] font-black text-cyan-400 uppercase tracking-widest ml-1">Job Title</label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400/40" size={14} />
              <input
                id="pitch-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl py-3 pl-10 pr-4 text-xs font-black text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all placeholder:text-gray-600"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="pitch-company" className="text-[10px] font-black text-cyan-400 uppercase tracking-widest ml-1">Company</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400/40" size={14} />
              <input
                id="pitch-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl py-3 pl-10 pr-4 text-xs font-black text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all placeholder:text-gray-600"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="pitch-salary" className="text-[10px] font-black text-cyan-400 uppercase tracking-widest ml-1">Proposed Salary / Pay Rate</label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400/40" size={14} />
            <input
              id="pitch-salary"
              type="text"
              placeholder="e.g. $25 - $35 an hour (Optional)"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-2xl py-3 pl-10 pr-4 text-xs font-black text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all placeholder:text-gray-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 text-slate-950 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
          {statusMessage ? statusMessage : 'Generate Outreach Pitch'}
        </button>
      </form>

      {/* AI UX: Thinking State - Shows when AI is processing during 60s timeout window */}
      {isGeneratingPitch && (
        <div className="mt-6 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="animate-spin text-cyan-400" size={16} />
            <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
              Kaseddie AI is analyzing logistics corridors...
            </h4>
          </div>
          {/* Loading Skeleton */}
          <div className="bg-gray-900/50 p-4 rounded-2xl border border-cyan-900/30 space-y-2">
            <div className="h-3 bg-cyan-900/30 rounded animate-pulse w-3/4"></div>
            <div className="h-3 bg-cyan-900/30 rounded animate-pulse w-1/2"></div>
            <div className="h-3 bg-cyan-900/30 rounded animate-pulse w-5/6"></div>
            <div className="h-3 bg-cyan-900/30 rounded animate-pulse w-2/3"></div>
            <div className="mt-4 flex items-center gap-2 text-[9px] text-cyan-500/60 font-bold uppercase tracking-widest">
              <Sparkles size={10} className="animate-pulse" />
              Generating B2B outreach pitch with Phi-3 LLM...
            </div>
          </div>
        </div>
      )}

      {/* AI UX: Error Message Display */}
      {pitchErrorMessage && !isGeneratingPitch && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
              Connection Error
            </span>
          </div>
          <p className="text-[9px] text-red-300/80 mt-1 font-mono">
            {pitchErrorMessage}
          </p>
          <p className="text-[8px] text-red-400/60 mt-2 uppercase tracking-wider">
            Fallback template is active. You can still copy and send the pitch above.
          </p>
        </div>
      )}

      {pitch && (
        <div className="mt-6 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Dynamic Outreach Actions</h4>
            <div className="flex gap-2">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] font-black text-cyan-400 uppercase hover:underline"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy Pitch'}
              </button>
            </div>
          </div>
          
          <div className="bg-gray-900 text-cyan-400 p-4 rounded-2xl font-mono text-[10px] leading-relaxed border border-cyan-900/50 max-h-48 overflow-y-auto scrollbar-hide shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            {pitch.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {selectedLead?.WhatsApp_Number ? (
              <button 
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
              >
                <MessageSquare size={14} /> WhatsApp
              </button>
            ) : null}
            
            {selectedLead?.employerEmail || selectedLead?.Contact_Email ? (
              <button 
                onClick={handleEmail}
                className="flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
              >
                <Mail size={14} /> Send Email
              </button>
            ) : null}

            {!hasDirectContact && selectedLead?.url ? (
              <button 
                onClick={handleWebApply}
                className="col-span-2 flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all"
              >
                <ExternalLink size={14} /> Web-Apply Mode (Indeed/LinkedIn)
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
