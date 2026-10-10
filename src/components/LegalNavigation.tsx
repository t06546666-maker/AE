import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { uiText } from '../uiText';
import type { ReactNode } from 'react';
import '../pages/legal.css';

export function LegalNavigation({ backTo, children }: { backTo: string; children: ReactNode }) {
  return <><div className="ae-legal-return"><Link to={backTo} replace><ArrowLeft size={20} aria-hidden="true" /><span>{uiText('Back to app')}</span></Link></div>{children}</>;
}
