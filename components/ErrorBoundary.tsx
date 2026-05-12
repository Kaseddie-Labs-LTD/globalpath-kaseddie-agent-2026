import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
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
      
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 border border-red-200 rounded-2xl">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-red-900 mb-2">Dashboard Error</h3>
          <p className="text-sm text-red-700 text-center mb-4">
            Handshake Interrupted: Please verify backend status and refresh.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-black text-sm hover:bg-red-700 transition-colors"
          >
            Reload Dashboard
          </button>
        </div>
      );
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
