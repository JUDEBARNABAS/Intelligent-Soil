import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={48} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-gray-500 text-sm">
              {this.state.error?.message.startsWith('{') 
                ? 'A database error occurred. Please check your permissions.' 
                : 'An unexpected error occurred. Please try again.'}
            </p>
            {this.state.error?.message.startsWith('{') && (
              <pre className="text-[10px] bg-gray-100 p-3 rounded-xl overflow-x-auto text-left text-gray-600">
                {JSON.stringify(JSON.parse(this.state.error.message), null, 2)}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center space-x-2 bg-indigo-600 text-white w-full py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              <RefreshCcw size={20} />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
