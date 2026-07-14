import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './toast';
import './styles.css';

sessionStorage.removeItem('ae_script_refresh');
sessionStorage.removeItem('ae_asset_refresh');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="boot-screen root-crash-state">
        <div className="boot-brand">Affiliate <span>AE</span></div>
        <strong>The application could not finish loading.</strong>
        <span>{this.state.error.message || 'An unexpected startup error occurred.'}</span>
        <button className="button primary" onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set('refresh', Date.now().toString());
          window.location.replace(url.toString());
        }}>Reload application</button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider><App /></ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </RootErrorBoundary>
  </React.StrictMode>,
);
