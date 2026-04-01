import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface ApplicationSuccessModalProps {
  onClose: () => void;
}

export const ApplicationSuccessModal: React.FC<ApplicationSuccessModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
        <div className="bg-green-600 p-6 text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-md">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Application Forwarded</h2>
        </div>
        <div className="p-8 text-center">
           <p className="text-gray-700 text-lg leading-relaxed font-medium">
             Your application has been forwarded to <span className="font-bold text-gray-900">GlobalPath Admin</span> for verification against the Germany/UAE visa requirements.
           </p>
           <div className="my-6 p-4 bg-brand-50 rounded-lg border border-brand-100 text-left">
              <h4 className="text-xs font-bold text-brand-800 uppercase mb-1">Next Steps</h4>
              <ul className="text-sm text-brand-700 space-y-1 list-disc list-inside">
                  <li>Compliance Check (24-48h)</li>
                  <li>Employer Verification</li>
                  <li>Visa Eligibility Screening</li>
              </ul>
           </div>
           <button 
             onClick={onClose}
             className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
           >
             Acknowledge & Continue
           </button>
        </div>
      </div>
    </div>
  );
};