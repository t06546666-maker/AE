import {useState,type FormEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {Mail,LockKeyhole,Eye,EyeOff,ShieldCheck,ArrowRight} from 'lucide-react';
import {uiText as t} from '../uiText';
import './accounts-login.css';
type Props={email:string;password:string;setEmail:(value:string)=>void;setPassword:(value:string)=>void;busy:boolean;error:string;onSubmit:(event:FormEvent)=>Promise<void>;department?:string;onBack?:()=>void};
export function AccountsLogin({email,password,setEmail,setPassword,busy,error,onSubmit,department,onBack}:Props){
 const {i18n}=useTranslation();const [visible,setVisible]=useState(false);
 return <section className="accounts-login-stage"><div className="accounts-login-window">
 <div className="accounts-login-top"><img src="/logo.png" alt="AE"/><select aria-label={t('Language')} value={i18n.language.startsWith('ml')?'ml':'en'} onChange={e=>void i18n.changeLanguage(e.target.value)}><option value="en">English</option><option value="ml">മലയാളം</option></select></div>
 <span className="accounts-login-emblem"><ShieldCheck size={26}/></span>
 <p className="accounts-login-eyebrow">{t(department?'AE Staff Portal':'AE Accounts Portal')}</p><h1>{department?t(department)+' · '+t('Login'):t('Account Head Login')}</h1><p className="accounts-login-intro">{t(department?'Sign in with your assigned staff credentials to manage your expenses.':'Sign in to review expense requests and record payments.')}</p>
 <form onSubmit={event=>void onSubmit(event)}><label htmlFor="accounts-email">{t('Email address')}</label><div className="accounts-login-field"><Mail size={18}/><input id="accounts-email" type="email" autoComplete="username" placeholder="name@company.com" required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></div>
 <label htmlFor="accounts-password">{t('Password')}</label><div className="accounts-login-field"><LockKeyhole size={18}/><input id="accounts-password" type={visible?'text':'password'} autoComplete="current-password" placeholder={t('Enter your password')} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={t(visible?'Hide password':'Show password')} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
 {error&&<p className="accounts-login-error" role="alert">{t(error)}</p>}
 <button type="submit" className="accounts-login-submit" disabled={busy}>{t(busy?'Signing in…':department?'Sign in':'Sign in to Accounts')}<ArrowRight size={18}/></button></form>
 {onBack&&<button className="staff-login-back" type="button" disabled={busy} onClick={onBack}>{t('Choose another department')}</button>}
 <p className="accounts-login-help">{t(department?'Ask your admin to create or reset your staff account.':'Need access? Ask your admin to create or reset your Account Head account.')}</p><div className="accounts-login-secure"><ShieldCheck size={15}/>{t(department?'Your assigned department access only':'Authorised Account Heads only')}</div>
 </div><small className="accounts-login-footer">AE · {t('Staff expense management')}</small></section>;
}
