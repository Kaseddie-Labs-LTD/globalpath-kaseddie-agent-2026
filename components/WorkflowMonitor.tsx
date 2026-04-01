
import React from 'react';
import { ApplicationWorkflow, WorkflowStage, getJobLocationString } from '../types';
import { Check, Clock, Plane, FileSearch, Building2, Calendar } from 'lucide-react';

interface WorkflowMonitorProps {
  workflows: ApplicationWorkflow[];
}

// Fixed type error: 'APPLYING' is not a valid WorkflowStage in types.ts. Changed to 'VETTING'.
const STAGES: { id: WorkflowStage; label: string; icon: any }[] = [
  { id: 'MATCHING', label: 'Matching', icon: FileSearch },
  { id: 'DOC_CHECK', label: 'Doc Verification', icon: Check },
  { id: 'VETTING', label: 'Vetting', icon: Building2 },
  { id: 'VISA_SCREENING', label: 'Visa Check', icon: Plane },
  { id: 'INTERVIEW_PREP', label: 'Interview', icon: Calendar },
  { id: 'OFFER', label: 'Offer', icon: Check },
];

export const WorkflowMonitor: React.FC<WorkflowMonitorProps> = ({ workflows }) => {
  if (workflows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Plane className="text-brand-600" size={18} />
          Active Application Workflows
        </h3>
        <span className="text-xs font-mono text-brand-600 bg-brand-50 px-2 py-1 rounded">
            AUTONOMOUS TRACKING ACTIVE
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {workflows.map((wf) => {
           const currentStageIdx = STAGES.findIndex(s => s.id === wf.stage);
           
           return (
             <div key={wf.id} className="p-4 hover:bg-slate-50 transition-colors">
               <div className="flex justify-between items-start mb-3">
                 <div>
                   <h4 className="font-bold text-slate-900 text-sm">{wf.jobTitle}</h4>
                   <p className="text-xs text-slate-500">{wf.company} • {getJobLocationString(wf.location as any)}</p>
                 </div>
                 <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                     wf.status === 'alert' ? 'bg-red-100 text-red-600 animate-pulse' :
                     wf.status === 'completed' ? 'bg-green-100 text-green-600' : 
                     'bg-blue-50 text-blue-600'
                 }`}>
                   {wf.status}
                 </div>
               </div>
               
               {/* Progress Bar */}
               <div className="relative h-2 bg-slate-200 rounded-full mb-4 overflow-hidden">
                 <div 
                   className="absolute top-0 left-0 h-full bg-brand-500 transition-all duration-1000 ease-out"
                   style={{ width: `${wf.progress}%` }}
                 ></div>
               </div>
               
               {/* Steps */}
               <div className="flex justify-between items-center text-xs">
                 {STAGES.map((stage, idx) => {
                   const isActive = idx === currentStageIdx;
                   const isCompleted = idx < currentStageIdx;
                   const Icon = stage.icon;
                   
                   return (
                     <div key={stage.id} className={`flex flex-col items-center gap-1 ${
                         isActive ? 'text-brand-600 font-bold' : 
                         isCompleted ? 'text-green-600' : 'text-slate-300'
                     }`}>
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                           isActive ? 'bg-brand-50 border-brand-200 shadow-sm' : 
                           isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'
                       }`}>
                          <Icon size={12} />
                       </div>
                       <span className="hidden sm:inline text-[9px]">{stage.label}</span>
                     </div>
                   );
                 })}
               </div>

               {/* Latest Log */}
               {wf.logs.length > 0 && (
                   <div className="mt-3 text-[10px] font-mono text-slate-500 bg-slate-100 p-2 rounded flex items-center gap-2">
                       <Clock size={10} />
                       {wf.logs[wf.logs.length - 1]}
                   </div>
               )}
             </div>
           );
        })}
      </div>
    </div>
  );
};
