import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { UserProfile } from '../types';
import { ErrorState, LoadingState } from './Common';
import '../pages/legal.css';
import { useTranslation } from 'react-i18next';

const LegalDetails = lazy(() => import('../pages/Legal').then(module => ({ default: module.LegalDetails })));

type Status = { enabled: boolean; accepted: boolean; termsVersion: string; privacyVersion: string };
export function LegalGate({ user, onLogout, children, preview = false }: { user: UserProfile; onLogout: () => void; children: ReactNode; preview?: boolean }) {
  const { i18n } = useTranslation();
  const ml = i18n.resolvedLanguage?.startsWith('ml');
  const c = (en: string, translated: string) => ml ? translated : en;
  const endpoint = user.role === 'customer' ? '/api/customer/legal' : '/api/profile/legal';
  const cache = useQueryClient();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const previewVersion = user.role === 'customer' ? '2026-10-22-customer-v3' : '2026-10-13-v2';
  const query = useQuery({ queryKey: ['legal-acceptance', user.id, user.role, preview], queryFn: () => preview ? Promise.resolve<Status>({ enabled: true, accepted: false, termsVersion: previewVersion, privacyVersion: previewVersion }) : apiFetch<Status>(endpoint), retry: false, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false });
  // Never enter on a cached acceptance while the current account/version is
  // still being checked. A failed check must keep the gate closed.
  if (query.isPending || query.isFetching) return <LoadingState />;
  if (query.isError) return <><ErrorState error={query.error} retry={() => void query.refetch()} /><button onClick={onLogout}>Sign out</button></>;
  if (!query.data.enabled || query.data.accepted || user.role === 'admin') return <>{children}</>;
  const type = user.role === 'field_manager' ? 'field' : user.role;
  const roleName = user.role === 'merchant' ? 'Merchant' : user.role === 'customer' ? 'Customer' : 'Field manager';
  async function accept() {
    if (!terms || !privacy || !consent || saving || !query.data) return;
    if (preview) { setError(c('Preview only — no acceptance has been saved.','മാതൃക മാത്രം — സമ്മതം സൂക്ഷിച്ചിട്ടില്ല.')); return; }
    setSaving(true); setError('');
    try {
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ termsVersion: query.data.termsVersion, privacyVersion: query.data.privacyVersion, termsAccepted: true, privacyAcknowledged: true, serviceConsent: true }) });
      await cache.invalidateQueries({ queryKey: ['legal-acceptance', user.id, user.role] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Acceptance could not be saved.'); }
    finally { setSaving(false); }
  }
  return <main className="ae-legal ae-consent">
    {preview && <aside>{c("Local preview only — no account data is used or saved. ","പ്രാദേശിക മാതൃക മാത്രം — അക്കൗണ്ട് വിവരങ്ങൾ ഉപയോഗിക്കുകയോ സൂക്ഷിക്കുകയോ ചെയ്യുന്നില്ല. ")}<a href="/consent-preview?role=merchant">{c("Merchant view","വ്യാപാരി മാതൃക")}</a> · <a href="/consent-preview?role=customer">{c("Customer view","ഉപഭോക്തൃ മാതൃക")}</a></aside>}
    <label>{c('Language','ഭാഷ')} <select value={ml ? 'ml' : 'en'} onChange={e => { void i18n.changeLanguage(e.target.value); localStorage.setItem('ae_language',e.target.value); }}><option value="en">English</option><option value="ml">മലയാളം</option></select></label>
    <header><img src="/logo.png" alt="AE" /><h1>{c(roleName, user.role === 'customer' ? 'ഉപഭോക്തൃ' : user.role === 'merchant' ? 'വ്യാപാരി' : 'ഫീൽഡ് മാനേജർ')}{c(' privacy & consent',' സ്വകാര്യതയും സമ്മതവും')}</h1><p>{c("Before entering AE, review these details. This applies to self-registration and accounts created by our team.","AEയിൽ പ്രവേശിക്കുന്നതിന് മുമ്പ് ഈ വിവരങ്ങൾ വായിക്കുക. സ്വയം രജിസ്റ്റർ ചെയ്തവർക്കും ഞങ്ങളുടെ ടീം സൃഷ്ടിച്ച അക്കൗണ്ടുകൾക്കും ഇത് ബാധകമാണ്.")}</p></header>
    <section><h2>{c("How your data is used","നിങ്ങളുടെ വിവരങ്ങൾ എങ്ങനെ ഉപയോഗിക്കുന്നു")}</h2><p>{user.role === 'merchant' ? 'AE uses your business and contact details to manage your account, publish listings and offers, and record purchases and points. Authorised staff can access records needed to support the service. Use customer information only for authorised transactions, not unrelated marketing.' : user.role === 'customer' ? c("AE uses your profile and contact details to manage your account, identify you in QR transactions, and record purchases and reward points. Participating merchants receive the customer details needed for your transactions. Authorised staff can access records needed to support the service.",'നിങ്ങളുടെ അക്കൗണ്ട് കൈകാര്യം ചെയ്യാനും QR ഇടപാടുകളിൽ നിങ്ങളെ തിരിച്ചറിയാനും വാങ്ങലുകളും റിവാർഡ് പോയിന്റുകളും രേഖപ്പെടുത്താനും AE നിങ്ങളുടെ പ്രൊഫൈലും ബന്ധപ്പെടാനുള്ള വിവരങ്ങളും ഉപയോഗിക്കുന്നു. ഇടപാടുകൾക്ക് ആവശ്യമായ ഉപഭോക്തൃവിവരങ്ങൾ പങ്കാളി വ്യാപാരികൾക്ക് ലഭിക്കും. സേവനം നൽകാൻ ആവശ്യമായ രേഖകൾ അധികാരമുള്ള ജീവനക്കാർക്ക് കാണാം.') : 'AE uses your work account, attendance and visit records for work management. Location sharing requires separate device permission.'}</p><p>{c("These checkboxes do not grant camera, location, notification or optional marketing permissions. Device permissions are requested separately when needed.","ഈ സമ്മതങ്ങൾ ക്യാമറ, സ്ഥാനം, അറിയിപ്പുകൾ, ഐച്ഛിക വിപണനം എന്നിവയ്ക്കുള്ള അനുമതികളല്ല. ഉപകരണ അനുമതികൾ ആവശ്യമുള്ളപ്പോൾ പ്രത്യേകം ചോദിക്കും.")}</p><p>{c("For privacy questions, correction or deletion requests, contact ","സ്വകാര്യത സംബന്ധിച്ച ചോദ്യങ്ങൾക്കും വിവരങ്ങൾ തിരുത്താനോ നീക്കാനോ ബന്ധപ്പെടുക: ")}<a href="mailto:safar@affiliateinnovations.co.in">safar@affiliateinnovations.co.in</a>.</p></section>
    <details><summary>{c('Read '+roleName+' Terms & Conditions', 'നിബന്ധനകളും വ്യവസ്ഥകളും വായിക്കുക')}</summary><Suspense fallback={<p>{c("Loading document…","രേഖ തുറക്കുന്നു…")}</p>}><LegalDetails type={type} /></Suspense></details>
    <details><summary>{c('Read Privacy Policy','സ്വകാര്യതാ നയം വായിക്കുക')}</summary><Suspense fallback={<p>{c('Loading document…','രേഖ തുറക്കുന്നു…')}</p>}><LegalDetails type="privacy" /></Suspense></details>
    <div className="ae-consent-checks">
      <label><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /> <span>{c('I agree to the Terms & Conditions for my account.','എന്റെ അക്കൗണ്ടിന്റെ നിബന്ധനകളും വ്യവസ്ഥകളും ഞാൻ അംഗീകരിക്കുന്നു.')}</span></label>
      <label><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} /> <span>{c('I have read and acknowledge the Privacy Policy.','സ്വകാര്യതാ നയം ഞാൻ വായിച്ച് മനസ്സിലാക്കിയിരിക്കുന്നു.')}</span></label>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> <span>{c('I consent to the use of my account and transaction data for the AE service as explained above.','മുകളിൽ വിശദീകരിച്ചതുപോലെ AE സേവനത്തിനായി എന്റെ അക്കൗണ്ട്, ഇടപാട് വിവരങ്ങൾ ഉപയോഗിക്കാൻ ഞാൻ സമ്മതിക്കുന്നു.')}</span></label>
    </div>
    <p>{c("Your acceptance is recorded against your account and document versions. New versions require another review. You can decline and sign out.","നിങ്ങളുടെ സമ്മതം അക്കൗണ്ടിനും രേഖകളുടെ പതിപ്പുകൾക്കുമൊപ്പം സൂക്ഷിക്കും. പുതിയ പതിപ്പുകൾ വീണ്ടും വായിച്ച് അംഗീകരിക്കണം. നിരസിച്ച് പുറത്തുകടക്കാനും കഴിയും.")}</p>
    {error && <p role="alert">{error}</p>}
    <div className="ae-consent-actions"><button disabled={!terms || !privacy || !consent || saving} onClick={() => void accept()}>{saving ? c('Saving…','സൂക്ഷിക്കുന്നു…') : c('Agree & Continue','അംഗീകരിച്ച് തുടരുക')}</button><button onClick={onLogout} disabled={saving}>{c("Decline & Sign Out","നിരസിച്ച് പുറത്തുകടക്കുക")}</button></div>
  </main>;
}
