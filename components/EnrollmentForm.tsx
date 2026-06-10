import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { FileText, Mail, Building2, ClipboardList, Users } from 'lucide-react';

interface EnrollmentData {
  fullName: string;
  company: string;
  industry: string;
  logisticsNeeds: string;
  email: string;
  phone?: string;
  passPhoto?: File | null;
  passportCopy?: File | null;
  cv?: File | null;
  type: 'APPLICANT' | 'CLIENT';
}

interface EnrollmentFormProps {
  onEnroll: (data: EnrollmentData) => void;
  initialLogisticsNeeds?: string;
}

export const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ onEnroll, initialLogisticsNeeds }) => {
  const [form, setForm] = useState<EnrollmentData>({
    fullName: '',
    company: '',
    industry: '',
    logisticsNeeds: '',
    email: '',
    type: 'APPLICANT',
    passPhoto: null,
    passportCopy: null,
    cv: null,
  });
  const [phonePrefix, setPhonePrefix] = useState<string>('+256');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    if (initialLogisticsNeeds && initialLogisticsNeeds.trim()) {
      setForm(prev => ({ ...prev, logisticsNeeds: initialLogisticsNeeds }));
    }
  }, [initialLogisticsNeeds]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFile = (name: keyof EnrollmentData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm(prev => ({ ...prev, [name]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, phone: `${phonePrefix}${phoneNumber.replace(/^0+/, '')}` };
      onEnroll(payload);
      setForm({
        fullName: '',
        company: '',
        industry: '',
        logisticsNeeds: '',
        email: '',
        type: 'APPLICANT',
        passPhoto: null,
        passportCopy: null,
        cv: null,
      });
      setPhonePrefix('+256');
      setPhoneNumber('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="enrollment-form" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 text-white shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Users size={20} className="text-amber-400" />
        <h3 className="text-xl font-black tracking-tight">Professional Enrollment</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="full-name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
            <input id="full-name" name="fullName" autoComplete="name" value={form.fullName} onChange={handleChange} className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" required />
          </div>
          <div>
            <label htmlFor="company" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company</label>
            <input id="company" name="company" autoComplete="organization" value={form.company} onChange={handleChange} className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
          </div>
          <div>
            <label htmlFor="industry" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry</label>
            <input id="industry" name="industry" autoComplete="organization-title" value={form.industry} onChange={handleChange} className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
          </div>
          <div>
            <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
            <input id="email" type="email" name="email" autoComplete="email" value={form.email} onChange={handleChange} className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" required />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="phone-number" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</label>
            <div className="flex gap-2 mt-1">
              <select id="phone-prefix" value={phonePrefix} onChange={(e) => setPhonePrefix(e.target.value)} className="w-32 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none">
                <option value="+256">+256 (Uganda)</option>
                <option value="+971">+971 (UAE)</option>
                <option value="+1">+1 (Canada)</option>
              </select>
              <input 
                id="phone-number"
                autoComplete="tel-national"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                placeholder="712345678"
                required
              />
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="logistics-needs" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logistics Needs</label>
          <textarea id="logistics-needs" name="logisticsNeeds" value={form.logisticsNeeds} onChange={handleChange} className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none h-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pass-photo" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pass Photo</label>
            <input id="pass-photo" type="file" accept="image/*" onChange={handleFile('passPhoto')} className="w-full mt-1 text-xs" />
          </div>
          <div>
            <label htmlFor="passport-copy" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passport Copy</label>
            <input id="passport-copy" type="file" accept="image/*,.pdf" onChange={handleFile('passportCopy')} className="w-full mt-1 text-xs" />
          </div>
          <div>
            <label htmlFor="cv-upload" className="text-[10px] font-black uppercase tracking-widest text-slate-400">CV/Resume</label>
            <input id="cv-upload" type="file" accept=".pdf,.doc,.docx" onChange={handleFile('cv')} className="w-full mt-1 text-xs" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select id="enrollment-type" name="type" value={form.type} onChange={handleChange} className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none">
            <option value="APPLICANT">New Applicant</option>
            <option value="CLIENT">New Client</option>
          </select>
          <button disabled={submitting} className="px-6 py-3 bg-amber-500 text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all">
            {submitting ? 'Submitting...' : 'Submit Enrollment'}
          </button>
        </div>
      </form>
    </div>
  );
};
