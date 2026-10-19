import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiFetch,downloadExport} from '../api';
import {uiText as t} from '../uiText';
const inr=(value:string)=>{const n=BigInt(value);return '₹'+(n/100n).toLocaleString('en-IN')+'.'+(n%100n).toString().padStart(2,'0')};
export function AccountsSummary({department,employee,refreshKey}:{department:string;employee:string;refreshKey:number}){
 const [month,setMonth]=useState(()=>new Date(Date.now()+330*60000).toISOString().slice(0,7));
 const query=new URLSearchParams({month,department,employee});
 const q=useQuery({queryKey:['accounts-summary',query.toString(),refreshKey],queryFn:()=>apiFetch<{totals:Record<string,string>}>('/api/accounts/summary?'+query)});
 return <details className="expense-card accounts-summary"><summary>{t('Monthly summary')}</summary><label>{t('Month')}<input type="month" required value={month} onChange={e=>setMonth(e.target.value)}/></label><p>{t('Based on expense date and current status. Department and employee filters apply. Approved includes paid; outstanding means approved but unpaid.')}</p>{q.error&&<p role="alert">{q.error.message}</p>}{q.isPending?<p>{t('Loading…')}</p>:q.data&&<div className="accounts-summary-grid">{[['requested','Requested'],['approved','Approved'],['paid','Paid'],['outstanding','Outstanding']].map(([key,label])=><article key={key}><span>{t(label)}</span><strong>{inr(q.data.totals[key]||'0')}</strong></article>)}</div>}</details>;
}
type ExportRow={id:string;department:string;category:string;expense_date:string;amount_paise:number;status:string;payment_method?:string;payment_date?:string;payment_reference?:string;payment_note?:string;profiles?:{full_name:string}};
const labels:Record<string,string>={draft:'Draft',submitted:'In review',corrections:'Corrections requested',approved:'Approved',rejected:'Rejected',paid:'Paid'};
export function AccountsExport({filters}:{filters:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function exportFile(pdf=false){setBusy(true);setError('');try{
  if(!pdf){await downloadExport('/api/accounts/report?'+filters+'&format=xlsx');return;}
  const report=await apiFetch<{claims:ExportRow[]}>('/api/accounts/report?'+filters);
  const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-10000px;width:1000px;height:800px';document.body.appendChild(frame);
  const doc=frame.contentDocument;if(!doc){frame.remove();throw Error('Print preview unavailable');}
  doc.open();doc.write('<!doctype html><html><head><title>AE expense records</title><style>body{font:12px sans-serif;color:#142b4b;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd8e8;padding:8px;text-align:left;overflow-wrap:anywhere}@page{size:A4 landscape;margin:12mm}</style></head><body><h1></h1><p></p><table><thead></thead><tbody></tbody></table></body></html>');doc.close();
  doc.querySelector('h1')!.textContent=t('Expense records');doc.querySelector('p')!.textContent=t('External payment records only. No transfers are executed or verified.')+' · '+new Date().toLocaleString();
  const header=doc.createElement('tr');for(const label of ['Employee','Department','Expense type','Expense date','Amount (INR)','Status','Payment method','Payment date','Payment reference','Payment note']){const cell=doc.createElement('th');cell.textContent=t(label);header.append(cell);}doc.querySelector('thead')!.append(header);
  for(const row of report.claims){const line=doc.createElement('tr');for(const value of [row.profiles?.full_name||'',t(row.department),t(row.category),row.expense_date,inr(String(row.amount_paise)),t(labels[row.status]||row.status),t(row.payment_method||''),row.payment_date||'',row.payment_reference||'',row.payment_note||'']){const cell=doc.createElement('td');cell.textContent=value;line.append(cell);}doc.querySelector('tbody')!.append(line);}
  await doc.fonts.ready;frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000);
 }catch(e){setError(e instanceof Error?e.message:'Export failed')}finally{setBusy(false)}}
 return <div className="accounts-exports"><button disabled={busy} onClick={()=>void exportFile()}>{t('Download Excel')}</button><button disabled={busy} onClick={()=>void exportFile(true)}>{t('Print / Save PDF')}</button>{error&&<p role="alert">{error}</p>}</div>;
}
