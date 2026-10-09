import { uiText } from '../uiText';
import { DateTimeInput } from './TimeInput';
import { formatDateTime } from '../utils';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { useToast } from '../toast';
import { Camera, Clock, MapPin, CalendarDays, CheckCircle2 } from 'lucide-react';
import './field-attendance.css';
import './field-visit-preview.css';
import { LiveCamera } from './LiveCamera';

type Attendance = { id: string; started_at: string; ended_at?: string; latitude: number; longitude: number };
type WorkRequest = { id: string; kind: string; starts_at: string; ends_at: string; reason: string; status: string };
export function FieldAttendance({ name }: { name: string }) {
  const client = useQueryClient(); const { showToast } = useToast();
  const [mode, setMode] = useState<'start' | 'leave' | 'non_field' | null>(null);
  const [selfie, setSelfie] = useState(''); const [starts, setStarts] = useState(''); const [ends, setEnds] = useState(''); const [reason, setReason] = useState('');
  const data = useQuery({ queryKey: ['field-attendance'], queryFn: () => apiFetch<{ attendance: Attendance | null; requests: WorkRequest[] }>('/api/field/attendance'), refetchInterval: 60000 });
  const attendance = data.data?.attendance;
  const refresh = () => { void client.invalidateQueries({ queryKey: ['field-attendance'] }); };
  const start = useMutation({ mutationFn: async () => {
    if (!selfie) throw new Error('Capture your selfie first.');
    if (!navigator.geolocation) throw new Error('Location is not supported.');
    const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
    return apiFetch('/api/field/attendance/start', { method: 'POST', body: JSON.stringify({ selfie, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_m: position.coords.accuracy }) });
  }, onSuccess: () => { refresh(); setMode(null); setSelfie(''); showToast('Your day has started.'); }, onError: error => showToast(error.message, 'error') });
  const end = useMutation({ mutationFn: () => apiFetch('/api/field/attendance/end', { method: 'POST' }), onSuccess: () => { refresh(); showToast('Your day is complete.'); }, onError: error => showToast(error.message, 'error') });
  const request = useMutation({ mutationFn: () => apiFetch('/api/field/work-requests', { method: 'POST', body: JSON.stringify({ kind: mode, starts_at: new Date(`${starts}:00+05:30`).toISOString(), ends_at: new Date(`${ends}:00+05:30`).toISOString(), reason }) }), onSuccess: () => { refresh(); setMode(null); setStarts(''); setEnds(''); setReason(''); showToast('Request submitted for review—not yet approved.'); }, onError: error => showToast(error.message, 'error') });
  const busy = start.isPending || end.isPending || request.isPending;
  async function capture(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2 * 1024 * 1024) { showToast('Use a JPG or PNG selfie under 2 MB.', 'error'); return; }
    const reader = new FileReader(); reader.onload = () => setSelfie(String(reader.result)); reader.readAsDataURL(file);
  }
  return <section className="field-attendance ae-workflow">
    <header><CalendarDays /><div><h1>{uiText("Attendance")}</h1><p>{uiText("Start your day, record attendance and manage work requests.")}</p></div></header>
    {data.isPending ? <p>{uiText("Loading attendance…")}</p> : data.isError ? <div role="alert"><p>{data.error.message}</p><button className="button secondary" onClick={() => void data.refetch()}>{uiText("Retry")}</button></div> : <>
      <div className="ae-greeting"><h2>{uiText("Good ")}{Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date())) < 12 ? uiText("morning") : uiText("day")}, {name}</h2><p>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p></div>
      {!attendance && <article className="attendance-card"><h2>{uiText("Take attendance selfie")}</h2><LiveCamera facing="user" disabled={busy} label={selfie ? 'Retake selfie' : 'Take attendance selfie'} onCapture={file => void capture(file)} />{selfie && <img className="attendance-selfie" src={selfie} alt={uiText("Your attendance selfie preview")} />}<p className="fpr-note">{uiText("Your location is recorded when you submit attendance and is visible to Admin.")}</p><button className="button primary ae-cta" disabled={busy || !selfie} onClick={() => start.mutate()}>{start.isPending ? uiText("Starting…") : uiText("Start Day")}</button></article>}
      {attendance && <article className="attendance-card"><h2>{attendance.ended_at ? uiText("Day completed") : uiText("Attendance recorded")}</h2><p>{uiText("Started: ")}{formatDateTime(attendance.started_at)}</p><p className="fpr-note">{uiText("Your attendance location is available to Admin.")}</p>{attendance.ended_at ? <p><CheckCircle2 size={17} />{uiText(" Ended: ")}{formatDateTime(attendance.ended_at)}</p> : <button className="button primary ae-cta" disabled={busy} onClick={() => { if (window.confirm('End your working day?')) end.mutate(); }}>{uiText("End Day")}</button>}</article>}
      <div className="attendance-actions"><button className="button secondary" onClick={() => setMode('leave')}>{uiText("Apply for Leave")}</button><button className="button secondary" onClick={() => setMode('non_field')}>{uiText("Non-field Work")}</button></div>
      <article className="attendance-card"><h2>{uiText("My requests")}</h2>{!data.data?.requests.length && <p>{uiText("No requests yet.")}</p>}{data.data?.requests.map(item => <div key={item.id} className="attendance-request"><strong>{item.kind === 'leave' ? uiText("Leave") : uiText("Non-field work")}</strong><span>{item.status}</span><p>{formatDateTime(item.starts_at)} — {formatDateTime(item.ends_at)}</p><p>{item.reason}</p></div>)}</article>
    </>}
    {mode && <div className="modal-backdrop"><form className="modal attendance-card" onSubmit={event => { event.preventDefault(); if (mode === 'start') start.mutate(); else request.mutate(); }}>
      <h2>{mode === 'start' ? uiText("Start Day") : mode === 'leave' ? uiText("Apply for Leave") : uiText("Apply Non-Field Work")}</h2>
      {mode === 'start' ? <><p>{uiText("Capture a selfie. Allow location access to record your starting location.")}</p><LiveCamera facing="user" disabled={busy} label="Take attendance selfie" onCapture={file => void capture(file)} />{selfie && <img className="attendance-selfie" src={selfie} alt={uiText("Your attendance selfie preview")} />}</> : <><label>{uiText("Start date and time")}<DateTimeInput value={starts} onChange={setStarts} /></label><label>{uiText("End date and time")}<DateTimeInput value={ends} onChange={setEnds} /></label><label>{uiText("Reason")}<select required value={reason} onChange={event => setReason(event.target.value)}><option value="">{uiText("Select reason")}</option>{(mode === 'leave' ? ['Personal leave','Sick leave','Family / medical emergency','Other'] : ['Training / meeting','Office work','Market route issues','Market survey','Other']).map(item => <option key={item} value={item}>{uiText(item)}</option>)}</select></label><p>{uiText("Requests are submitted as pending, not automatically approved.")}</p></>}
      <div className="attendance-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setMode(null)}>{uiText("Cancel")}</button><button className="button primary" disabled={busy || (mode === 'start' && !selfie)}>{busy ? uiText("Saving…") : mode === 'start' ? uiText("Start Day") : uiText("Submit request")}</button></div>
    </form></div>}
  </section>;
}
