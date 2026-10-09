import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { uiText } from './uiText';

type ToastType = 'success' | 'error';
type ToastContextValue = { showToast: (message: string, type?: ToastType) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  useTranslation(undefined, { bindI18n: 'languageChanged loaded' });
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const value = useMemo(() => ({
    showToast(message: string, type: ToastType = 'success') {
      setToast({ message, type });
      window.setTimeout(() => setToast(null), 3500);
    },
  }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <div className={`toast ${toast.type}`} role="status">{uiText(toast.message)}</div> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
