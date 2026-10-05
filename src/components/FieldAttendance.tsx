import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { useToast } from '../toast';
import { Camera, Clock, MapPin, CalendarDays, CheckCircle2 } from 'lucide-react';
import './field-attendance.css';

type Attendance = { id: string; started_at: string; ended_at?: string; latitude: number; longitude: number };
type WorkRequest = { id: string; kind: string; starts_at: string; ends_at: string; reason: string; status: string };
export function FieldAttendance({ name }: { name: string }) {
  const client = useQueryClient(); const { showToast } = useToast();
  const [mode, setMode] = useState<'start' | 'leave' | 'non_field' | null>(null);
  const [selfie, setSelfie] = useState(''); const [starts, setStarts] = useState(''); const [ends, setEnds] = useState(''); const [reason, setReason] = useState('');
  const [deferred, setDeferred] = useState(false);
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
  const request = useMutation({ mutationFn: () => apiFetch('/api/field/work-requests', { method: 'POST', body: JSON.stringify({ kind: mode, starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString(), reason }) }), onSuccess: () => { refresh(); setMode(null); setStarts(''); setEnds(''); setReason(''); showToast('Request submitted for review—not yet approved.'); }, onError: error => showToast(error.message, 'error') });
  const busy = start.isPending || end.isPending || request.isPending;
  async function capture(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2 * 1024 * 1024) { showToast('Use a JPG or PNG selfie under 2 MB.', 'error'); return; }
    const reader = new FileReader(); reader.onload = () => setSelfie(String(reader.result)); reader.readAsDataURL(file);
  }
  return <section className="field-attendance">
    <header><CalendarDays /><div><h1>Attendance</h1><p>Start your day, record attendance and manage work requests.</p></div></header>
    {data.isPending ? <p>Loading attendance…</p> : data.isError ? <div role="alert"><p>{data.error.message}</p><button className="button secondary" onClick={() => void data.refetch()}>Retry</button></div> : <>
      <article className="attendance-card"><h2>Welcome, {name}</h2><p>{attendance ? attendance.ended_at ? 'Your day is complete.' : 'Your day is in progress.' : 'Do you want to start your day?'}</p>
      {attendance ? <><p><Clock size={17} /> Start: {new Date(attendance.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p><p><MapPin size={17} /> Starting location recorded</p>{attendance.ended_at ? <p><CheckCircle2 size={17} /> End: {new Date(attendance.ended_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p> : <button className="button primary" disabled={busy} onClick={() => { if (window.confirm('End your working day?')) end.mutate(); }}>End Day</button>}</> : <><button className="button primary" onClick={() => { setMode('start'); setDeferred(false); }}>Yes, Start Day</button><button className="button secondary" onClick={() => setDeferred(true)}>Not yet</button>{deferred && <p>You can start your day when you are ready.</p>}</>}
      <div className="attendance-actions"><button className="button secondary" onClick={() => setMode('leave')}>Apply for Leave</button><button className="button secondary" onClick={() => setMode('non_field')}>Apply Non-Field Work</button></div></article>
      <article className="attendance-card"><h2>My requests</h2>{!data.data?.requests.length && <p>No requests yet.</p>}{data.data?.requests.map(item => <div key={item.id} className="attendance-request"><strong>{item.kind === 'leave' ? 'Leave' : 'Non-field work'}</strong><span>{item.status}</span><p>{new Date(item.starts_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} — {new Date(item.ends_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p><p>{item.reason}</p></div>)}</article>
    </>}
    {mode && <div className="modal-backdrop"><form className="modal attendance-card" onSubmit={event => { event.preventDefault(); if (mode === 'start') start.mutate(); else request.mutate(); }}>
      <h2>{mode === 'start' ? 'Start Day' : mode === 'leave' ? 'Apply for Leave' : 'Apply Non-Field Work'}</h2>
      {mode === 'start' ? <><p>Capture a selfie. Allow location access to record your starting location.</p><label><Camera /> Capture selfie<input type="file" accept="image/jpeg,image/png" capture="user" disabled={busy} onChange={event => void capture(event.target.files?.[0])} /></label>{selfie && <img className="attendance-selfie" src={selfie} alt="Your attendance selfie preview" />}</> : <><label>Start date and time<input required type="datetime-local" value={starts} onChange={event => setStarts(event.target.value)} /></label><label>End date and time<input required type="datetime-local" value={ends} onChange={event => setEnds(event.target.value)} /></label><label>Reason<select required value={reason} onChange={event => setReason(event.target.value)}><option value="">Select reason</option>{(mode === 'leave' ? ['Personal leave','Sick leave','Family / medical emergency','Other'] : ['Training / meeting','Office work','Market route issues','Market survey','Other']).map(item => <option key={item}>{item}</option>)}</select></label><p>Requests are submitted as pending, not automatically approved.</p></>}
      <div className="attendance-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setMode(null)}>Cancel</button><button className="button primary" disabled={busy || (mode === 'start' && !selfie)}>{busy ? 'Saving…' : mode === 'start' ? 'Start Day' : 'Submit request'}</button></div>
    </form></div>}
  </section>;
}
