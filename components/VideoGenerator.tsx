
import React, { useState } from 'react';
import { Video, Sparkles, Loader2, Play, Download, Globe, Zap, AlertCircle, MapPin, Briefcase } from 'lucide-react';
import { API_BASE, fetcher } from '../constants/api';

export const VideoGenerator: React.FC = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:10000";

  const handleGenerate = async () => {
    if (!jobTitle || !location) return;
    setLoading(true);
    setVideoUrl(null);
    setImageUrl(null);
    setStatus('Contacting Media Engine...');
    
    try {
      const response = await fetcher('/generate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_title: jobTitle, location })
      });

      const data = response;
      if (data && data.status === 'Success') {
        setImageUrl(data.image_url);
        setVideoUrl(data.video_url);
        setStatus('Generation complete.');
      }
    } catch (error) {
      console.error(error);
      setStatus('Engine failure: Verify API tokens in .env');
    } finally {
      setLoading(false);
    }
  };

  const templates = [
    { title: "Registered Nurse", loc: "Berlin, Germany" },
    { title: "Warehouse Manager", loc: "Dubai, UAE" },
    { title: "Hospitality Crew", loc: "Alberta, Canada" },
    { title: "Construction Lead", loc: "Warsaw, Poland" }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-12">
      <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Video className="text-brand-500" size={24} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-400">AI Media Engine</span>
            <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">
               <Zap size={8} /> Media Engine Active
            </div>
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-tight">AI Promo Generator</h2>
          <p className="text-slate-400 max-w-lg text-sm leading-relaxed mb-8">
            Generate high-conversion cinematic videos for recruitment. Powered by Fal.ai (Flux) & Replicate (Kling).
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Job Title (e.g. Registered Nurse)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location (e.g. Berlin, Germany)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleGenerate}
                disabled={loading || !jobTitle || !location}
                className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Generate Video
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
               {templates.map(t => (
                 <button 
                    key={`${t.title}-${t.loc}`} 
                    onClick={() => { setJobTitle(t.title); setLocation(t.loc); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                 >
                   {t.title} - {t.loc}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton & Video Display Area */}
      {(loading || videoUrl || imageUrl) ? (
        <div className={`bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden ${(videoUrl || imageUrl) ? 'animate-slideUp' : 'animate-pulse'}`}>
           <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className={`p-2 ${(videoUrl || imageUrl) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'} rounded-xl`}>
                   {(videoUrl || imageUrl) ? <Zap size={20} /> : <Loader2 size={20} className="animate-spin" />}
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-slate-900">{(videoUrl || imageUrl) ? 'Generation Result' : 'Dreaming up visuals...'}</h3>
                    {!videoUrl && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{status}</p>}
                 </div>
              </div>
              {videoUrl && (
                <div className="flex gap-2">
                   <button onClick={() => window.open(videoUrl, '_blank')} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><Download size={20} /></button>
                </div>
              )}
           </div>

           <div className="aspect-video bg-slate-950 relative group">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-contain"
                />
              ) : imageUrl ? (
                <div className="relative w-full h-full">
                  <img src={imageUrl} alt="Generated Preview" className="w-full h-full object-cover opacity-50 blur-sm" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-black/40">
                    <div className="relative mb-6">
                        <div className="w-24 h-24 border-4 border-white/5 rounded-full"></div>
                        <div className="absolute inset-0 w-24 h-24 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        <Video className="absolute inset-0 m-auto text-brand-500 animate-pulse" size={32} />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-white font-black uppercase tracking-widest text-sm">Animating Sequence...</h4>
                        <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em]">{status}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                   <div className="relative mb-6">
                      <div className="w-24 h-24 border-4 border-white/5 rounded-full"></div>
                      <div className="absolute inset-0 w-24 h-24 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <Sparkles className="absolute inset-0 m-auto text-brand-500 animate-pulse" size={32} />
                   </div>
                   <div className="space-y-2">
                      <div className="h-4 w-48 bg-white/5 rounded-full mx-auto animate-pulse"></div>
                      <div className="h-3 w-64 bg-white/5 rounded-full mx-auto animate-pulse"></div>
                   </div>
                </div>
              )}
           </div>

           {videoUrl && (
             <>
               <div className="p-6 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-start">
                  <button 
                    onClick={() => handleDownload(videoUrl!)}
                    className="px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 transition-all"
                    title="Optimized for WhatsApp Status"
                  >
                    Download for WhatsApp Status
                  </button>
                  <button 
                    onClick={() => handleDownload(videoUrl!)}
                    className="px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest bg-black text-pink-500 hover:text-pink-400 transition-all border border-slate-200"
                    title="Optimized for TikTok"
                  >
                    Download for TikTok
                  </button>
                  <button 
                    onClick={() => handleDownload(videoUrl!)}
                    className="px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 transition-all"
                    title="Optimized for LinkedIn"
                  >
                    Download for LinkedIn
                  </button>
               </div>
               <div className="p-8 bg-slate-50 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm"><Globe className="text-brand-500" /></div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    This asset is ready for deployment on LinkedIn, WhatsApp Broadcasts, and TikTok. Ensure you include the GlobalPath tracking link in the caption.
                  </p>
               </div>
             </>
           )}
        </div>
      ) : (
        /* Initial Empty State Placeholder */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center group hover:border-brand-200 transition-all">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                 <Video className="text-slate-300 group-hover:text-brand-500 transition-colors" size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Ready to create?</h3>
              <p className="text-xs text-slate-400 max-w-xs font-medium">Select a template or type a prompt above to generate your recruitment video.</p>
           </div>
           
           <div className="bg-brand-50 p-8 rounded-[2rem] border border-brand-100 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4 text-brand-600">
                <AlertCircle size={20} />
                <h4 className="font-black text-[10px] uppercase tracking-widest">Pro Tip</h4>
              </div>
              <p className="text-sm text-brand-700 leading-relaxed font-medium">
                Be specific about the "AVA Trinity" in your prompt. Mentioning "free flights" and "verified accommodation" helps the AI focus on trust-building imagery.
              </p>
           </div>
        </div>
      )}
    </div>
  );
};
