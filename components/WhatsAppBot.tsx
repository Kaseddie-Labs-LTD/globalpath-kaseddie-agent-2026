
import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, MoreVertical, ArrowLeft, Paperclip, Smile, Camera, Mic, Briefcase, MapPin, Search, Megaphone, CheckCircle2, Copy, ExternalLink, Hash, Users, ShieldCheck, Zap, Eye } from 'lucide-react';
import { UserProfile, Job, getJobLocationString } from '../types';
import { searchAndMatchJobs } from '../services/ai';
import { fetcher } from '../constants/api';

interface Message {
  id: string;
  text?: string;
  sender: 'user' | 'bot';
  time: string;
  type?: 'text' | 'job_card' | 'system';
  jobData?: Job;
}

interface WhatsAppBotProps {
  profile?: UserProfile;
  verifiedJobs?: Job[];
  onBotApplication?: (job: Job) => string;
}

export const WhatsAppBot: React.FC<WhatsAppBotProps> = ({ profile, verifiedJobs = [], onBotApplication }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      text: "Hello! 👋 I'm Kaseddie. I can help you find jobs in UAE, Saudi Arabia, and Europe using our real-time Apify aggregator.", 
      sender: 'bot', 
      time: '--:--', 
      type: 'text'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [broadcastPhone, setBroadcastPhone] = useState('+256');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = profile?.userType === 'ADMIN';

  useEffect(() => {
    setMessages(prev => prev.map((m, i) => i === 0 ? { ...m, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : m));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isSearching]);

  const getBroadcastContent = () => {
    const priorityRegions = ["UAE", "Qatar", "Germany", "Canada"];
    const sortedJobs = [...verifiedJobs].sort((a, b) => {
      const aLoc = getJobLocationString(a.location).toLowerCase();
      const bLoc = getJobLocationString(b.location).toLowerCase();
      const aPriority = priorityRegions.some(r => aLoc.includes(r.toLowerCase())) ? 1 : 0;
      const bPriority = priorityRegions.some(r => bLoc.includes(r.toLowerCase())) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.matchScore - a.matchScore;
    });

    const topJobs = sortedJobs.slice(0, 15);
    const messageTemplate = topJobs.map(job => `
📌 *${(job.title || "Unknown Role").toUpperCase()}*
📍 ${getJobLocationString(job.location)}
💰 ${job.salary || 'Competitive'}
✅ [VISA + TICKET INCLUDED]
----------------------------`).join('\n');

    return `🌟 *VERIFIED GLOBALPATH OPPORTUNITIES* 🌟\n${messageTemplate}\n\nApply via: globalpath.ug/apply`;
  };

  const handleManualBroadcast = () => {
    const text = getBroadcastContent();
    const phone = broadcastPhone.replace(/\+/g, '').replace(/\s/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyBroadcast = () => {
    const text = getBroadcastContent();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJobSearch = async () => {
    if (!profile) return;
    setIsSearching(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: "🔍 Scanning global endpoints for compliant vacancies...",
      sender: 'bot',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'system'
    }]);

    try {
      const jobs = await searchAndMatchJobs(profile.role, profile.targetRegions[0]);
      setIsSearching(false);
      if (jobs.length > 0) {
        setMessages(prev => [...prev, {
          id: Date.now().toString() + 'header',
          text: `Found ${jobs.length} new matches!`,
          sender: 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text'
        }]);
        jobs.slice(0, 3).forEach((job, index) => {
          setMessages(prev => [...prev, {
            id: Date.now().toString() + index,
            sender: 'bot',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'job_card',
            jobData: job
          }]);
        });
      }
    } catch (e) {
      setIsSearching(false);
    }
  };

  const handleBotApply = (job: Job | undefined) => {
      if (!job) return;
      
      const leadId = onBotApplication?.(job);
      
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `✅ Application for *${job.title}* has been received!\n\nSuccess: Lead logged to HR Secure Portal.\n*Lead ID: ${leadId}*`,
          sender: 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text'
      }]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), text: input, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    if (input.toLowerCase().includes('job') || input.toLowerCase().includes('search')) {
       setTimeout(() => { setIsTyping(false); handleJobSearch(); }, 1000);
       return;
    }

    try {
      // Use backend chat endpoint instead of direct GoogleGenAI
      const response = await fetcher('/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input 
        })
      });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: response?.reply || "I'm recalibrating. Please repeat that.",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text'
      }]);
    } catch (e) {
      console.warn('Failed to send message:', e);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "⚠️ Uplink lost.", sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'text' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-50 overflow-auto">
        <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          <div className="md:w-80 bg-slate-900 p-8 text-white space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-500 rounded-2xl">
                <Megaphone size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Broadcast Bridge</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 mb-2 text-brand-400">
                  <Users size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Network Size</span>
                </div>
                <div className="text-2xl font-black">12,450+</div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col p-8 bg-white overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Broadcast Queue</h3>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 relative group">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={handleCopyBroadcast} className="p-2 bg-white rounded-xl shadow-sm hover:text-brand-600">
                    {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Message Preview Template</div>
                <div className="font-mono text-xs text-slate-600 bg-white p-6 rounded-2xl border border-slate-100 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {getBroadcastContent()}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Number</label>
                   <input 
                        type="text"
                        value={broadcastPhone}
                        onChange={(e) => setBroadcastPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-sm font-bold"
                        placeholder="+256..."
                      />
                </div>
                <div className="flex items-end">
                   <button 
                    onClick={handleManualBroadcast}
                    className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
                   >
                     Broadcast to Network
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center justify-center p-4 bg-gray-100">
      <div className="flex flex-col h-[700px] w-full bg-[#E5DDD5] relative overflow-hidden rounded-[30px] shadow-2xl border-[8px] border-gray-800 max-w-[380px]">
        <div className="bg-[#075E54] h-6 w-full"></div>
        <div className="bg-[#075E54] text-white p-3 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-2">
            <ArrowLeft size={20} />
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Kaseddie" alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-semibold text-sm">Kaseddie Agent</div>
              <div className="text-[10px] text-white/80">{isSearching ? 'searching...' : 'online'}</div>
            </div>
          </div>
          <div className="flex gap-4 pr-1">
            <Search size={18} />
            <Phone size={18} />
            <MoreVertical size={18} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5] scrollbar-hide relative">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat' }}></div>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex relative z-10 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'job_card' && msg.jobData ? (
                <div className="bg-white rounded-lg p-3 shadow-sm w-[85%] border-l-4 border-brand-500">
                    <h4 className="font-bold text-sm text-gray-900">{msg.jobData.title}</h4>
                    <p className="text-xs text-gray-600 mb-2">{msg.jobData.company}</p>
                    <button 
                        onClick={() => handleBotApply(msg.jobData)}
                        className="block w-full text-center bg-[#25D366] text-white py-1.5 rounded text-xs font-bold uppercase shadow-sm"
                    >
                        Apply via GlobalPath
                    </button>
                     <div className="text-[9px] text-gray-400 text-right mt-1">{msg.time}</div>
                </div>
              ) : msg.type === 'system' ? (
                <div className="w-full flex justify-center my-2">
                    <div className="bg-[#E1F3FB] text-gray-600 text-[10px] py-1 px-3 rounded-full shadow-sm flex items-center gap-1">
                        <Briefcase size={10} /> {msg.text}
                    </div>
                </div>
              ) : (
                <div className={`max-w-[85%] rounded-lg p-2 px-3 shadow-sm text-[13.5px] whitespace-pre-wrap ${
                    msg.sender === 'user' ? 'bg-[#DCF8C6] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'
                }`}>
                    {msg.text}
                    <div className={`text-[10px] text-gray-500 text-right mt-1`}>
                    {msg.time}
                    </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="bg-[#F0F0F0] p-2 flex items-center gap-2 pb-6">
           <Smile size={24} className="text-gray-500 ml-1" />
           <div className="flex-1 bg-white rounded-full flex items-center px-3 py-2">
             <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="Type a message..."
               className="flex-1 bg-transparent outline-none text-sm text-gray-700"
             />
             <Paperclip size={20} className="text-gray-400 ml-2" />
           </div>
           <button onClick={handleSend} className="w-10 h-10 bg-[#008f79] rounded-full flex items-center justify-center text-white shadow-sm">
             <Send size={18} className="ml-0.5" />
           </button>
        </div>
      </div>
    </div>
  );
};
