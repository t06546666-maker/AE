import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Store, UserRound } from 'lucide-react';
import './auth.css';

export function RoleSwitch({ merchant = false }: { merchant?: boolean }) {
  return <nav className="ae-auth-roles" aria-label="Account type"><Link to="/customer/login" aria-current={!merchant ? 'page' : undefined}><UserRound />Customer</Link><Link to="/login" aria-current={merchant ? 'page' : undefined}><Store />Merchant</Link></nav>;
}
export function AuthShell({ merchant = false, children }: { merchant?: boolean; children: ReactNode }) {
  return <main className={`ae-auth-page ae-auth-login ${merchant ? 'is-merchant' : ''}`}><div className="ae-auth-window"><div className="ae-auth-hero" role="img" aria-label={merchant ? 'AE. Where customers meet businesses, beyond. Grow your business with AE. More customers. More repeat visits. Simple rewards.' : 'AE. Where customers meet businesses, beyond. Shop Local. Get Rewards Everywhere. One network. More value.'} /><section className="ae-auth-sheet"><RoleSwitch merchant={merchant} />{children}</section></div></main>;
}
