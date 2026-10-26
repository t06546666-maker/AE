import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {apiFetch} from '../api';
import {uiText as t} from '../uiText';
import {formatDateTime} from '../utils';
type Attendance={id:string;work_date:string;started_at:string;admin_started_by?:string;admin_start_reason?:string};
export function AdminAttendanceControl({managerId,name}:{managerId:string;name:string}){
 const [action,setAction]=useState<'start'|'end'|null>(null),[reason,setReason]=useState(''),[message,setMessage]=useState('');
 const [targetId,setTargetId]=useState<string>();
 const client=useQueryClient();
 const state=useQuery({queryKey:['admin-attendance-control',managerId],queryFn:()=>apiFetch<{today:string;active:Attendance|null;todayRecorded:boolean}>(`/api/admin/field-managers/${encodeURIComponent(managerId)}/attendance-control`),refetchInterval:30000});
 const change=useMutation({retry:false,mutationFn:(input:{action:'start'|'end';attendanceId?:string;reason:string})=>apiFetch(`/api/admin/field-managers/${encodeURIComponent(managerId)}/attendance/force-${input.action}`,{method:'POST',body:JSON.stringify({reason:input.reason,attendanceId:input.attendanceId})}),onSuccess:()=>{setMessage(t('Attendance updated by Admin.'));setAction(null);setReason('');for(const key of ['admin-attendance-control','admin-field-history','read-profile','field-attendance','admin-check-in-map'])void client.invalidateQueries({queryKey:[key]});},onError:()=>{void state.refetch();}});
 const active=state.data?.active;
 function open(next:'start'|'end'){setTargetId(active?.id);setAction(next);setReason('');setMessage('');change.reset();}
 return <section className="panel"><h2>{t('Attendance — Admin controls')}</h2><p>{t('Admin overrides use the current time, require a reason and are saved in the audit history. No selfie or GPS is invented.')}</p>
 {state.isPending?<p role="status">{t('Loading attendance…')}</p>:state.isError?<p role="alert">{state.error.message} <button type="button" onClick={()=>void state.refetch()}>{t('Retry')}</button></p>:<>
 <p>{active?<>{t('Active working day')} · {formatDateTime(active.started_at)}{active.admin_started_by&&<> · {t('Started by Admin')}: {active.admin_start_reason}</>}</>:state.data?.todayRecorded?t('Today’s attendance is already completed.'):t('No active working day.')}</p>
 <div className="attendance-actions"><button className="button primary" disabled={!!active||state.data?.todayRecorded||change.isPending} onClick={()=>open('start')}>{t('Force Start Attendance')}</button><button className="button secondary" disabled={!active||change.isPending} onClick={()=>open('end')}>{t('Force End Attendance')}</button></div></>}
 {message&&<p role="status">{message}</p>}
 {action&&<div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-label={t(action==='start'?'Force Start Attendance':'Force End Attendance')} onSubmit={event=>{event.preventDefault();if(reason.trim().length<5||change.isPending||(action==='end'&&(!active||active.id!==targetId)))return;change.mutate({action,reason:reason.trim(),attendanceId:targetId});}}>
 <h2>{t(action==='start'?'Force Start Attendance':'Force End Attendance')}</h2><p>{name}</p><p>{t(action==='start'?'Start this manager’s attendance now without a selfie or GPS? This will be marked as an Admin override.':'End this manager’s active working day now? This does not close any active shop visit.')}</p>
 <label>{t('Reason (mandatory)')}<textarea autoFocus required minLength={5} maxLength={2000} rows={4} value={reason} disabled={change.isPending} onChange={event=>setReason(event.target.value)}/></label>
 {change.error&&<p role="alert">{change.error.message}</p>}<div className="attendance-actions"><button type="button" className="button secondary" disabled={change.isPending} onClick={()=>setAction(null)}>{t('Cancel')}</button><button className="button primary" disabled={change.isPending||reason.trim().length<5||(action==='end'&&!active)}>{t(change.isPending?'Saving…':'Confirm attendance override')}</button></div>
 </form></div>}
 </section>;
}
