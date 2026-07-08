import React, { useState, useRef } from 'react';
import { Download, Image, Sparkles, Globe, Briefcase, Building2, Loader2, Share2, Zap } from 'lucide-react';
import { Job } from '../types';
import { APP_CONFIG } from '../constants/appConfig';

interface MarketingEngineProps {
  selectedJob: Job | null;
  onGenerateMarketing: (job: Job) => Promise<string>;
  onLog?: (message: string, type: 'info' | 'success' | 'error', step?: string) => void;
}

export const MarketingEngine: React.FC<MarketingEngineProps> = ({ 
  selectedJob, 
  onGenerateMarketing,
  onLog 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [marketingImage, setMarketingImage] = useState<string | null>(null);
  const [marketingText, setMarketingText] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateMarketingContent = async () => {
    if (!selectedJob) {
      onLog?.('No job selected for marketing generation', 'error', 'MARKETING');
      return;
    }

    setIsGenerating(true);
    onLog?.(`🎨 [MARKETING]: Generating content for ${selectedJob.company || 'Unknown Company'} - ${selectedJob.title || 'Unknown Role'}`, 'info', 'MARKETING');

    try {
      // Generate marketing text based on job details
      const prompt = `
Create compelling marketing copy for this job opportunity:

Company: ${selectedJob.company || 'Unknown Company'}
Role: ${selectedJob.title || 'Unknown Role'}
Location: ${typeof selectedJob.location === 'string' ? selectedJob.location : selectedJob.location?.city || 'Global Opportunity'}

Generate a professional, engaging marketing message that highlights:
1. The company's prestige
2. The role's key benefits
3. The location advantages
4. A clear call-to-action

Keep it under 150 words and make it suitable for WhatsApp sharing.
      `.trim();

      // Call the marketing generation API
      const marketingContent = await onGenerateMarketing(selectedJob);
      setMarketingText(marketingContent);
      
      // Generate the marketing image
      await generateMarketingImage(selectedJob, marketingContent);
      
      onLog?.(`✅ [MARKETING]: Marketing assets generated for ${selectedJob.company || 'Unknown Company'}`, 'success', 'MARKETING');
    } catch (error) {
      console.error('Marketing generation error:', error);
      onLog?.(`❌ [MARKETING]: Failed to generate content - ${error}`, 'error', 'MARKETING');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMarketingImage = async (job: Job, text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Safe property access
    const title = job?.title || 'Unknown Role';
    const company = job?.company || 'Unknown Company';
    const location = typeof job?.location === 'string' ? job.location : 
                     job?.location?.city || job?.location?.country || 'Global Opportunity';
    const jobId = job?.id?.substring(0, 4) || '0821';

    // Set canvas dimensions (WhatsApp optimized)
    canvas.width = 1080;
    canvas.height = 1080;

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#1a1a1a');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add cyberpunk grid pattern
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // === CYBERPUNK HUD LAYER ===
    
    // Left Side: Vertical line with vetting status
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 100);
    ctx.lineTo(50, 300);
    ctx.stroke();
    
    // Left side text
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('VETTING STATUS: VERIFIED', 60, 120);
    ctx.fillText(`NODE ID: #${jobId}`, 60, 140);
    ctx.fillText('CORRIDOR: ACTIVE', 60, 160);
    ctx.fillText('CLEARANCE: LEVEL 5', 60, 180);
    
    // Add glowing effect to vertical line
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 100);
    ctx.lineTo(50, 300);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // GlobalPath logo placeholder (text-based)
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GLOBALPATH', canvas.width / 2, 120);
    
    ctx.font = '24px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Elite Logistics & Strategic Manpower', canvas.width / 2, 160);
    ctx.shadowBlur = 0;

    // Add company name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    const companyY = 280;
    wrapText(ctx, company, canvas.width / 2, companyY, 900, 50);

    // Add role title
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px sans-serif';
    const roleY = 380;
    wrapText(ctx, title, canvas.width / 2, roleY, 900, 45);

    // Add location
    ctx.fillStyle = '#64748b';
    ctx.font = '24px sans-serif';
    ctx.fillText(`📍 ${location}`, canvas.width / 2, 480);

    // Add marketing text
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    const textY = 580;
    wrapText(ctx, text.substring(0, 200) + '...', canvas.width / 2, textY, 900, 30);

    // === BOTTOM CENTER HUD BOX ===
    const hudBoxY = 850;
    const hudBoxWidth = 600;
    const hudBoxHeight = 120;
    const hudBoxX = (canvas.width - hudBoxWidth) / 2;
    
    // Semi-transparent dark box with cyan border
    ctx.fillStyle = 'rgba(10, 10, 10, 0.8)';
    ctx.fillRect(hudBoxX, hudBoxY, hudBoxWidth, hudBoxHeight);
    
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(hudBoxX, hudBoxY, hudBoxWidth, hudBoxHeight);
    
    // HUD text content
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ROLE: ${title.toUpperCase()}`, canvas.width / 2, hudBoxY + 30);
    ctx.fillText('SALARY: HIGH-YIELD', canvas.width / 2, hudBoxY + 55);
    ctx.fillText('COST: ZERO-FEE', canvas.width / 2, hudBoxY + 80);
    
    // Add glowing effect to HUD box
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.strokeRect(hudBoxX, hudBoxY, hudBoxWidth, hudBoxHeight);
    ctx.shadowBlur = 0;

    // Add call-to-action
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Apply Now ➡️', canvas.width / 2, 750);

    // Add contact info
    ctx.fillStyle = '#64748b';
    ctx.font = '18px monospace';
    ctx.fillText(`📱 ${APP_CONFIG.HR_WHATSAPP} | 🌐 globalpathkaseddieagent.com`, canvas.width / 2, 920);

    // Convert canvas to image
    const imageUrl = canvas.toDataURL('image/png', 0.9);
    setMarketingImage(imageUrl);
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  };

  const downloadForWhatsApp = () => {
    if (!marketingImage) return;

    const link = document.createElement('a');
    link.download = `globalpath-marketing-${selectedJob?.company || 'lead'}-${Date.now()}.png`;
    link.href = marketingImage;
    link.click();
    
    onLog?.(`📱 [MARKETING]: Marketing image downloaded for WhatsApp sharing`, 'success', 'MARKETING');
  };

  const shareOnWhatsApp = () => {
    if (!selectedJob || !marketingText) return;

    const message = `🚀 *${selectedJob.company || 'Unknown Company'}* - ${selectedJob.title || 'Unknown Role'}

${marketingText}

📱 Apply: ${APP_CONFIG.HR_WHATSAPP}
🌐 www.globalpathkaseddieagent.com

#GlobalPath #Jobs #${selectedJob.corridor || 'Global'}`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${APP_CONFIG.HR_WHATSAPP.replace('+', '')}?text=${encodedMessage}`, '_blank');
    
    onLog?.(`📤 [MARKETING]: Shared on WhatsApp for ${selectedJob.company || 'Unknown Company'}`, 'success', 'MARKETING');
  };

  return (
    <div className="marketing-engine bg-[#0a0a0a] rounded-[2rem] border border-cyan-900/50 text-cyan-400 shadow-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">Marketing Engine</h3>
            <p className="text-[9px] font-black text-cyan-500/60 uppercase tracking-widest">AI-Powered Brand Assets • WhatsApp Ready</p>
          </div>
        </div>
        {selectedJob?.corridor && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1a] rounded-full border border-cyan-900/50">
            <Globe size={10} className="text-cyan-400" />
            <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">{selectedJob.corridor}</span>
          </div>
        )}
      </div>

      {!selectedJob ? (
        <div className="text-center py-12">
          <Image size={48} className="mx-auto text-cyan-400/20 mb-4" />
          <p className="text-cyan-400/60 font-black text-sm">Select a verified node to generate marketing materials</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Selected Job Info */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-cyan-400" />
                <span className="text-white font-black">{selectedJob.company}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-cyan-400" />
                <span className="text-white font-black">{selectedJob.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-cyan-400" />
                <span className="text-white font-black">{selectedJob.corridor}</span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateMarketingContent}
            disabled={isGenerating}
            className="w-full bg-cyan-600 text-slate-950 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 hover:bg-cyan-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            {isGenerating ? 'Generating Marketing Assets...' : 'Generate Marketing Materials'}
          </button>

          {/* Marketing Results */}
          {(marketingImage || marketingText) && (
            <div className="space-y-4 animate-fadeIn">
              {/* Marketing Text */}
              {marketingText && (
                <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
                  <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-2">Marketing Copy</h4>
                  <p className="text-white text-sm leading-relaxed">{marketingText}</p>
                </div>
              )}

              {/* Marketing Image */}
              {marketingImage && (
                <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
                  <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3">Marketing Image (1080x1080)</h4>
                  <img 
                    src={marketingImage} 
                    alt="Marketing Material" 
                    className="w-full max-w-md mx-auto rounded-xl border border-cyan-900/30"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={downloadForWhatsApp}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95"
                >
                  <Download size={16} />
                  Download for WhatsApp
                </button>
                <button
                  onClick={shareOnWhatsApp}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-500 transition-all active:scale-95"
                >
                  <Share2 size={16} />
                  Share on WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden Canvas for Image Generation */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width="1080"
        height="1080"
      />
    </div>
  );
};
