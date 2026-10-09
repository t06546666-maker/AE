import { uiText } from '../uiText';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Store, UserRound, Handshake, TrendingUp } from 'lucide-react';
import './auth.css';

export function RoleSwitch({ merchant = false }: { merchant?: boolean }) {
  return <nav className="ae-auth-roles" aria-label={uiText("Account type")}><Link to="/customer/login" aria-current={!merchant ? 'page' : undefined}><UserRound />{uiText("Customer")}</Link><Link to="/login" aria-current={merchant ? 'page' : undefined}><Store />{uiText("Merchant")}</Link></nav>;
}
export function AuthShell({ merchant = false, children }: { merchant?: boolean; children: ReactNode }) {
  return <main className={`ae-auth-page ae-auth-login ${merchant ? 'is-merchant' : ''}`}><div className="ae-auth-window"><header className="ae-auth-hero">
    <img className="ae-auth-brand" src="/logo.png" alt="AE" />
    <h2>{uiText('Where customers meet businesses and beyond')}</h2>
    <p className="ae-auth-tagline">{uiText('Customers and businesses, together in one digital space.')}</p>
    <div className="ae-auth-values">{[{ label:'Merchants', Icon:Store }, { label:'Customers', Icon:UserRound }, { label:'Trust', Icon:Handshake }, { label:'Growth', Icon:TrendingUp }].map(({ label, Icon }) => <div key={label}><span><Icon aria-hidden="true" /></span><strong>{uiText(label)}</strong></div>)}</div>
  </header><section className="ae-auth-sheet"><RoleSwitch merchant={merchant} />{children}</section></div></main>;
}
