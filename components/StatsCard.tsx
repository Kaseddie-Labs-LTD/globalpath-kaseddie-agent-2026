import React from 'react';
import { ShieldAlert, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  trend?: number;
  description?: string;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon, 
  color = 'brand',
  trend,
  description,
  onClick
}) => {
  const colorClasses = {
    brand: 'bg-brand-500 text-white',
    red: 'bg-red-500 text-white',
    green: 'bg-green-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    purple: 'bg-purple-500 text-white'
  };

  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200 shadow-xl p-6 hover:shadow-2xl transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-brand-500' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-black ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-slate-600'
          }`}>
            <TrendingUp size={14} className={trend < 0 ? 'rotate-180' : ''} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <h3 className="text-2xl font-black text-slate-900">{value.toLocaleString()}</h3>
        <p className="text-sm font-black text-slate-600 uppercase tracking-widest">{title}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-2">{description}</p>
        )}
      </div>
    </div>
  );
};

interface FeesBlockedCardProps {
  flaggedLeadsCount: number;
  totalLeadsCount: number;
  onClick?: () => void;
}

export const FeesBlockedCard: React.FC<FeesBlockedCardProps> = ({ 
  flaggedLeadsCount, 
  totalLeadsCount,
  onClick
}) => {
  const percentage = totalLeadsCount > 0 ? (flaggedLeadsCount / totalLeadsCount) * 100 : 0;
  
  return (
    <StatsCard
      title="Fees Blocked"
      value={flaggedLeadsCount}
      icon={<ShieldAlert size={20} />}
      color="red"
      trend={percentage > 0 ? Math.round(percentage) : 0}
      description={`Ethical AI blocked ${flaggedLeadsCount} fee-charging violations`}
      onClick={onClick}
    />
  );
};
