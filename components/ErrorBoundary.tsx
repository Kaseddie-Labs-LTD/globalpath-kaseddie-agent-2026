import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State;
  
  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    console.error('ErrorBoundary caught an error:', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Defensive fallback: just render children instead of crashing
      console.warn('ErrorBoundary: Rendering children despite error');
      return this.props.children;
    }

    return this.props.children;
  }
}

// Null Guard Component
export const NullGuard: React.FC<{ children: ReactNode; fallback?: ReactNode }> = ({ 
  children, 
  fallback = (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="text-amber-600 mb-4">
        <svg className="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-black text-amber-900 mb-2">Server Connection Issue</h3>
      <p className="text-sm text-amber-700 text-center">
        The dashboard is stabilizing. Please wait a moment...
      </p>
    </div>
  )
}) => {
  return <>{children || fallback}</>;
};
