import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {apiFetch} from '../api';
import {uiText as t} from '../uiText';
export function AdminDeleteFieldManager({id,name}:{id:string;name:string}){
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[reason,setReason]=useState('');
 const client=useQueryClient(),navigate=useNavigate();
 const remove=useMutation({retry:false,mutationFn:()=>apiFetch(`/api/admin/field-managers/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({confirmation,reason:reason.trim()})}),onSuccess:()=>{setOpen(false);for(const key of ['admin-field-managers','read-profile','admin-field-history','admin-attendance-control'])void client.invalidateQueries({queryKey:[key]});navigate('/field-managers',{replace:true});}});
 return <><button type="button" className="button secondary" disabled={remove.isPending} onClick={()=>{setOpen(true);setConfirmation('');setReason('');remove.reset();}}>{t('Delete permanently')}</button>{open&&<div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-label={t('Delete Field Manager permanently')} onSubmit={event=>{event.preventDefault();if(confirmation==='DELETE'&&reason.trim().length>=5&&!remove.isPending)remove.mutate();}}>
 <h2>{t('Delete Field Manager permanently')}</h2><strong>{name}</strong>
 <p>{t('This permanently deletes the login, profile and linked attendance, selfies, visits, sessions, routes, work requests and field activity. This cannot be undone. Shops, customers, rewards and financial records are not deleted.')}</p>
 <p>{t('Deletion is blocked if financial or other protected records still depend on this account.')}</p>
 <label>{t('Reason (mandatory)')}<textarea autoFocus required minLength={5} maxLength={2000} rows={3} value={reason} onChange={event=>setReason(event.target.value)} disabled={remove.isPending}/></label>
 <label>{t('Type DELETE to confirm')}<input required value={confirmation} autoComplete="off" spellCheck={false} onChange={event=>setConfirmation(event.target.value)} disabled={remove.isPending}/></label>
 {remove.error&&<p role="alert">{remove.error.message}</p>}<div className="attendance-actions"><button type="button" className="button secondary" disabled={remove.isPending} onClick={()=>setOpen(false)}>{t('Cancel')}</button><button className="button primary" disabled={remove.isPending||confirmation!=='DELETE'||reason.trim().length<5}>{t(remove.isPending?'Deleting…':'Delete permanently')}</button></div>
 </form></div>}</>;
}
