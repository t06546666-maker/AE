import {useState} from 'react';
import {apiFetch} from '../api';
type Login={merchantCode:string;loginEmail:string;temporaryPassword:string;expiresAt:number};
export function PrivatePucTest(){
 const [requestId]=useState(()=>crypto.randomUUID()),[login,setLogin]=useState<Login|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(){if(busy)return;setBusy(true);setError('');try{setLogin(await apiFetch<Login>('/api/admin/private-puc-test',{method:'POST',body:JSON.stringify({requestId})}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel" style={{marginBottom:20}}><h2>Private PUC testing</h2><p>Separate test login. Hidden from customer shop lists and live merchant counts. No real customer rewards, welcome bonus, email or WhatsApp messages.</p><button type="button" className="button secondary" disabled={busy} onClick={()=>void create()}>{busy?'Preparing test login…':login?'Show this test login':'Create private PUC test account'}</button>{error&&<p role="alert">{error}</p>}{login&&<div role="status"><h3>AE PUC TEST · TEST ONLY</h3><p><strong>Merchant ID:</strong> {login.merchantCode}</p><p><strong>Email:</strong> {login.loginEmail}</p><p><strong>Password:</strong> <code>{login.temporaryPassword}</code></p><p>Valid until {new Date(login.expiresAt).toLocaleDateString('en-IN')}. Sign in as Merchant in version 99, then choose Add Customer or Vehicle Expiry. Added records remain inside this test account.</p></div>}</section>;
}
