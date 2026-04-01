import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, AlertCircle, Loader2, CheckCircle, XCircle, AlertTriangle, Eye, Wand2 } from 'lucide-react';
import { VerificationReport } from '../types';

interface FileUploadProps {
  label: string;
  icon?: React.ElementType;
  accept?: string;
  onUpload: (file: File) => Promise<void>;
  verification: VerificationReport | null;
  enhancedImageUrl?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, icon: Icon, accept = ".pdf,.jpg,.png", onUpload, verification, enhancedImageUrl }) => {
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const processFile = async (file: File) => {
    setLoading(true);
    await onUpload(file);
    setLoading(false);
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
      e.dataTransfer.clearData();
    }
  };

  const renderStatusBadge = () => {
    if (!verification) return null;

    switch (verification.status) {
      case 'verified':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-600 text-white rounded-md shadow-sm transform transition-all duration-300">
            <CheckCircle size={14} strokeWidth={3} />
            <span className="text-xs font-bold uppercase tracking-wider">Verified</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white rounded-md shadow-sm transform transition-all duration-300">
            <XCircle size={14} strokeWidth={3} />
            <span className="text-xs font-bold uppercase tracking-wider">Rejected</span>
          </div>
        );
      default: // needs_review or pending
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-md shadow-sm">
            <AlertTriangle size={14} strokeWidth={2} />
            <span className="text-xs font-bold uppercase tracking-wider">{verification.status.replace('_', ' ')}</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-brand-300 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-brand-600" />}
          <label className="text-sm font-semibold text-gray-700">{label}</label>
        </div>
        {renderStatusBadge()}
      </div>

      <div className="flex gap-4">
          <div 
            className={`relative flex-1 ${enhancedImageUrl ? 'w-1/2' : 'w-full'}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={accept}
              onChange={handleChange}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
            <div className={`border-2 border-dashed rounded-md p-6 text-center transition-all duration-200 h-full flex flex-col justify-center items-center ${
              loading ? 'border-brand-200 bg-brand-50' : 
              isDragging ? 'border-brand-500 bg-brand-50 scale-[1.02] shadow-inner' :
              'border-gray-200 hover:bg-gray-50'
            }`}>
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-brand-500" />
                  <span className="text-xs text-brand-600">Processing...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={20} className={`transition-colors ${isDragging ? 'text-brand-600' : 'text-gray-400'}`} />
                  <span className={`text-xs transition-colors ${isDragging ? 'text-brand-700 font-semibold' : 'text-gray-500'}`}>
                    {isDragging ? 'Drop file here' : 'Click/Drag to Upload'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {enhancedImageUrl && (
              <div className="w-1/2 relative group">
                  <div className="absolute top-2 right-2 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md z-10">
                      <Wand2 size={10} /> AI Enhanced
                  </div>
                  <img src={enhancedImageUrl} alt="Enhanced" className="w-full h-32 object-cover rounded-md border border-brand-200 shadow-sm" />
              </div>
          )}
      </div>

      {verification && verification.details && (
        <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
          <ul className="list-disc pl-4 space-y-1">
            {verification.details.map((d, i) => (
              <li key={`${d}-${i}`}>{d}</li>
            ))}
          </ul>
           {verification.warnings.length > 0 && (
              <div className="mt-2 text-yellow-700 border-t border-yellow-200 pt-1">
                 <strong>Notes:</strong> {verification.warnings.join(', ')}
              </div>
           )}
        </div>
      )}
    </div>
  );
};
