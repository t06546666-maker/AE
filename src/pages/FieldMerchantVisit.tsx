import { useEffect, useState } from 'react';
import { canVisit, visitDistance } from '../visitLocation';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, Phone, Store, Clock } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import { useToast } from '../toast';
import '../components/field-route-planning.css';
import '../components/field-visit-preview.css';
import { FieldMerchantMapper } from '../components/FieldMerchantMapper';

type Merchant = { id: string; name: string; merchant_code: string; address?: string; phone?: string; email?: string; image_url?: string; latitude?: number; longitude?: number };
type Visit = { id: string; merchant_id: string; status: string; check_in_at: string; check_out_at?: string; photos?: string[]; notes?: string; outcome?: string; follow_up_date?: string; problems?: string; feedback?: string };
export function FieldMerchantVisit() {
  const { id = '' } = useParams(); const client = useQueryClient(); const { showToast } = useToast();
  const [photo, setPhoto] = useState(''); const [notes, setNotes] = useState(''); const [preparing, setPreparing] = useState(false);
  const [outcome, setOutcome] = useState(''); const [followUp, setFollowUp] = useState(''); const [problems, setProblems] = useState(''); const [feedback, setFeedback] = useState('');
  const [location, setLocation] = useState<GeolocationPosition | null>(null); const [locationError, setLocationError] = useState(''); const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setLocation(null); setLocationError(''); setPhoto(''); setNotes(''); setOutcome(''); setFollowUp(''); setProblems(''); setFeedback('');
    if (!navigator.geolocation) { setLocationError('Location is not supported.'); return; }
    const watcher = navigator.geolocation.watchPosition(position => { setLocation(position); setLocationError(''); }, () => { setLocation(null); setLocationError('Allow location access to enable visits.'); }, { enableHighAccuracy:true, maximumAge:0, timeout:15000 });
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => { navigator.geolocation.clearWatch(watcher); clearInterval(timer); };
  }, [id]);
  const profile = useQuery({ queryKey: ['read-profile', 'field-merchant', id], queryFn: () => apiFetch<{ merchant: Merchant; activityRecorded: boolean }>(`/api/field/merchants/${encodeURIComponent(id)}/profile`), staleTime: Infinity });
  const history = useQuery({ queryKey: ['field-visits'], queryFn: () => apiFetch<{ visits: Visit[] }>('/api/field/visits'), refetchInterval: 15000 });
  const active = history.data?.visits.find(visit => visit.status === 'active');
  const ownActive = active?.merchant_id === id ? active : null;
  const gps = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not supported.')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  });
  const start = useMutation({ mutationFn: async () => {
    if (!photo) throw new Error('Capture the shop photo first.'); const location = await gps();
    return apiFetch('/api/field/visits/start', { method: 'POST', body: JSON.stringify({ merchantId: id, latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy, photo }) });
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: ['field-visits'] }); setPhoto(''); showToast('Visit started.'); }, onError: error => showToast(error.message, 'error') });
  const finish = useMutation({ mutationFn: async () => {
    if (!ownActive) throw new Error('No active visit to finish.'); const location = await gps();
    return apiFetch(`/api/field/visits/${encodeURIComponent(ownActive.id)}/check-out`, { method: 'POST', body: JSON.stringify({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy, notes, outcome, follow_up_date: followUp || undefined, problems, feedback }) });
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: ['field-visits'] }); setNotes(''); showToast('Visit completed.'); }, onError: error => showToast(error.message, 'error') });
  async function capture(file?: File) {
    if (!file) return;
    if (!['image/jpeg','image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { showToast('Choose a JPG or PNG under 10 MB.', 'error'); return; }
    setPreparing(true); const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); const ratio = Math.min(1, 500 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
      const context = canvas.getContext('2d'); if (!context) throw new Error('Photo processing unavailable.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Burn the watermark into the pixels, so it remains in the saved photo.
      const markSize = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * 0.09));
      const margin = Math.max(5, Math.round(markSize * 0.4));
      context.save();
      context.font = `700 ${markSize}px Arial, sans-serif`;
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      context.lineWidth = Math.max(1, markSize * 0.06);
      context.strokeStyle = 'rgba(0,0,0,0.5)';
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.strokeText('AE', canvas.width - margin, canvas.height - margin);
      context.fillText('AE', canvas.width - margin, canvas.height - margin);
      context.restore();
      let result = canvas.toDataURL('image/jpeg', 0.6);
      if (result.length > 80000) result = canvas.toDataURL('image/jpeg', 0.3);
      if (result.length > 80000) throw new Error('Photo is too large. Retake it with lower resolution.');
      setPhoto(result);
    } catch (error) { showToast((error as Error).message, 'error'); }
    finally { URL.revokeObjectURL(url); setPreparing(false); }
  }
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  const merchant = profile.data.merchant; const busy = start.isPending || finish.isPending || preparing;
  const distance = location && merchant.latitude != null && merchant.longitude != null ? visitDistance(location.coords.latitude, location.coords.longitude, Number(merchant.latitude), Number(merchant.longitude)) : null;
  const nearby = !locationError && !!location && clock - location.timestamp < 30000 && canVisit(distance, location.coords.accuracy);
  const time = (date: string) => new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return <div className="dashboard-page"><section className="field-route-planning ae-workflow">
    <Link to="/field?section=routes">← Back to routes</Link>
    <header><Store /><div><h1>{ownActive ? 'Visit Report' : 'Start Visit'}</h1><p>{merchant.name} · {merchant.merchant_code}</p></div></header>
    <article className="attendance-card"><h2>Merchant information</h2><p><MapPin size={17} /> {merchant.address || 'Address not added'}</p>{merchant.phone && <p><Phone size={17} /> <a href={`tel:${merchant.phone}`}>{merchant.phone}</a></p>}<p>{merchant.email}</p>{merchant.image_url && <img src={merchant.image_url} alt={merchant.name} style={{ maxWidth:'100%',maxHeight:220,borderRadius:14 }} />}</article>
    {!profile.data.activityRecorded && <p role="alert">Profile-view activity could not be recorded.</p>}
    <article className="attendance-card"><h2>{ownActive ? 'Visit in progress' : 'Check-in location'}</h2>
      {!ownActive && merchant.latitude != null && merchant.longitude != null && <div className="ae-checkin-map"><FieldMerchantMapper merchants={[merchant]} categories={[]} visitPosition={location ? { latitude: location.coords.latitude, longitude: location.coords.longitude } : null} /></div>}
      {ownActive && <div className="ae-visit-clock"><Clock /><div><small>Visit in progress</small><br /><strong>{new Date(Math.max(0, clock - Date.parse(ownActive.check_in_at))).toISOString().slice(11,19)}</strong></div></div>}
      <div className={`ae-location ${nearby ? '' : 'waiting'}`}><MapPin /><div><strong>{nearby ? 'Within 50 m' : 'Check-in range required'}</strong><small>Visit actions available within 50 metres</small></div></div>
      <p role="status">{locationError || (distance == null ? 'Waiting for GPS location…' : `${Math.round(distance)} m from the merchant · GPS accuracy ±${Math.round(location!.coords.accuracy)} m`)}</p>
      {!nearby && <p role="alert">Visit actions are available only within 50 metres with a fresh, accurate GPS reading. Outside this radius, the visit remains open; it is not ended automatically.</p>}
      {history.isPending ? <p>Loading visits…</p> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()} /> : ownActive ? <><p><Clock size={17} /> Started: {time(ownActive.check_in_at)}</p>{ownActive.photos?.[0] && <img src={ownActive.photos[0]} alt="Shop photo captured for this visit" style={{ maxWidth:'100%',maxHeight:240 }} />}<label>Outcome<select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="">Select outcome</option>{['Completed','Follow-up required','Merchant unavailable','Issue reported'].map(item => <option key={item}>{item}</option>)}</select></label><label>Visit Notes<textarea placeholder="What happened during your visit?" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label><label>Follow-up date<input type="date" value={followUp} onChange={event => setFollowUp(event.target.value)} /></label><label>Problems (optional)<textarea placeholder="Any issues faced at the outlet?" maxLength={2000} value={problems} onChange={event => setProblems(event.target.value)} /></label><label>Feedback (optional)<textarea placeholder="Merchant feedback or suggestions?" maxLength={2000} value={feedback} onChange={event => setFeedback(event.target.value)} /></label><button className="button primary" disabled={busy || !nearby || !outcome || (outcome === 'Follow-up required' && !followUp)} onClick={() => { if (window.confirm('Complete this merchant visit?')) finish.mutate(); }}>{busy ? 'Saving…' : 'End Visit'}</button></> : active ? <p>Finish your current visit before starting another. <Link to={`/field/merchants/${encodeURIComponent(active.merchant_id)}`}>Open active visit</Link></p> : <>
        <p>Capture the outlet photo, review it, then Start Visit. GPS must be within 50 metres of the merchant.</p>
        <label><Camera /> Capture shop photo<input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy} onChange={event => { void capture(event.target.files?.[0]); event.target.value = ''; }} /></label>
        {photo && <><img src={photo} alt="Shop photo preview" style={{ maxWidth:'100%',maxHeight:240,borderRadius:14 }} /><button type="button" className="button secondary" disabled={busy} onClick={() => setPhoto('')}>Remove / retake</button></>}
        <button className="button primary" disabled={!photo || busy || !nearby} onClick={() => start.mutate()}>{busy ? 'Preparing visit…' : 'Start Visit'}</button>
        {(merchant.latitude == null || merchant.longitude == null) && <p>Merchant GPS location must be added before a visit can start.</p>}
      </>}
    </article>
    <article className="attendance-card"><h2>My visits to this merchant</h2>{history.data?.visits.filter(visit => visit.merchant_id === id).map(visit => <div className="attendance-request" key={visit.id}><strong>{visit.status === 'active' ? 'In progress' : visit.status}</strong><p>{time(visit.check_in_at)}{visit.check_out_at ? ` — ${time(visit.check_out_at)}` : ''}</p><p>{visit.outcome}</p><p>{visit.notes}</p>{visit.follow_up_date && <p>Follow-up: {visit.follow_up_date}</p>}{visit.problems && <p>Problems: {visit.problems}</p>}{visit.feedback && <p>Feedback: {visit.feedback}</p>}</div>)}{history.data && !history.data.visits.some(visit => visit.merchant_id === id) && <p>No visits recorded yet.</p>}</article>
  </section></div>;
}
