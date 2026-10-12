import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { downloadExport,queryString } from '../api';
import { uiText } from '../uiText';
export function AdminUsageDownloads({range,area,valid,compact=false}:{range?:{from:string;to:string};area:string;valid:boolean;compact?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function exportReport(report:string){if(!range||!valid)return;setBusy(true);setError('');try{await downloadExport(`/api/admin/usage?${queryString({...range,area,format:'xlsx',report})}`);}catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
 return <div className={compact?'admin-export-options':'admin-card'}>{!compact&&<h2>{uiText('Download usage reports')}</h2>}<button type="button" className={compact?'admin-period-option':'button secondary'} disabled={busy||!valid} onClick={()=>void exportReport('accounts')}><FileSpreadsheet size={17}/>{uiText('Active accounts Excel')}</button><button type="button" className={compact?'admin-period-option':'button secondary'} disabled={busy||!valid||Boolean(area)} onClick={()=>void exportReport('installations')}><FileSpreadsheet size={17}/>{uiText('Observed Android installations Excel')}</button>{busy&&<p role="status">{uiText('Exporting…')}</p>}<details className="admin-export-note"><summary>{uiText('About these downloads')}</summary><p>{uiText('Installations are observed after sign-in, not Play Store downloads. Installation identities are not linked to customers or areas.')}</p>{area&&<p>{uiText('Choose All areas to export installations.')}</p>}</details>{error&&<p role="alert">{error}</p>}</div>;
}
