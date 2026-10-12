import { useState } from 'react';
import { downloadExport,queryString } from '../api';
import { uiText } from '../uiText';
export function AdminUsageDownloads({range,area,valid}:{range?:{from:string;to:string};area:string;valid:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function exportReport(report:string){if(!range||!valid)return;setBusy(true);setError('');try{await downloadExport(`/api/admin/usage?${queryString({...range,area,format:'xlsx',report})}`);}catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 return <section className="admin-card" style={{marginBottom:18}}><h2>{uiText('Download usage reports')}</h2><div className="form-actions"><button className="button secondary" disabled={busy||!valid} onClick={()=>void exportReport('accounts')}>{uiText('Active accounts Excel')}</button><button className="button secondary" disabled={busy||!valid||Boolean(area)} onClick={()=>void exportReport('installations')}>{uiText('Observed Android installations Excel')}</button></div><p className="admin-data-note">{uiText('Installations are observed after sign-in, not Play Store downloads. Installation identities are not linked to customers or areas.')}</p>{error&&<p role="alert">{error}</p>}</section>;
}
