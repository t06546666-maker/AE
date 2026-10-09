import { uiText } from '../uiText';
import { formatDateTime, formatClockTime } from '../utils';
import { useEffect, useState } from 'react';
import { canVisit, visitDistance } from '../visitLocation';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, Phone, Store, Clock } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState } from '../components/Common';
import { useToast } from '../toast';
import '../components/field-route-planning.css';
import '../components/field-visit-preview.css';
import '../field-complete-preview.css';
import { FieldMerchantMapper } from '../components/FieldMerchantMapper';
import { LiveCamera } from '../components/LiveCamera';

type Merchant = { id: string; name: string; merchant_code: string; address?: string; phone?: string; email?: string; image_url?: string; latitude?: number; longitude?: number; opening_time?: string; closing_time?: string };
type Visit = { id: string; merchant_id: string; status: string; admin_closed_at?: string; admin_close_reason?: string; check_in_at: string; check_out_at?: string; photos?: string[]; notes?: string; outcome?: string; follow_up_date?: string; problems?: string; feedback?: string; reason?: string; challenge_status?: string; report_image?: string };
export function FieldMerchantVisit() {
  const [params] = useSearchParams(); const visitMode = params.get('visit') === '1';
  const { id = '' } = useParams(); const client = useQueryClient(); const { showToast } = useToast();
  const [photo, setPhoto] = useState(''); const [notes, setNotes] = useState(''); const [preparing, setPreparing] = useState(false);
  const [outcome, setOutcome] = useState(''); const [followUp, setFollowUp] = useState(''); const [problems, setProblems] = useState(''); const [feedback, setFeedback] = useState('');
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState(''); const [challenge, setChallenge] = useState('Pending'); const [reportPhoto, setReportPhoto] = useState('');
  const [location, setLocation] = useState<GeolocationPosition | null>(null); const [locationError, setLocationError] = useState(''); const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setReview(false);
    setReason(''); setChallenge('Pending'); setReportPhoto('');
    setLocation(null); setLocationError(''); setPhoto(''); setNotes(''); setOutcome(''); setFollowUp(''); setProblems(''); setFeedback('');
    if (!visitMode) return;
    if (!navigator.geolocation) { setLocationError('Location is not supported.'); return; }
    const watcher = navigator.geolocation.watchPosition(position => { setLocation(position); setLocationError(''); }, () => { setLocation(null); setLocationError('Allow location access to enable visits.'); }, { enableHighAccuracy:true, maximumAge:0, timeout:15000 });
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => { navigator.geolocation.clearWatch(watcher); clearInterval(timer); };
  }, [id, visitMode]);
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
    return apiFetch(`/api/field/visits/${encodeURIComponent(ownActive.id)}/check-out`, { method: 'POST', body: JSON.stringify({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy, notes, reason, challenge_status: challenge || null, report_image: reportPhoto || null, outcome: challenge === 'Follow-up required' ? "Follow-up required" : challenge && challenge !== 'Solved' ? "Issue reported" : "Completed", follow_up_date: followUp || undefined, problems, feedback }) });
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: ['field-visits'] }); setNotes(''); setReview(false); showToast('Visit completed.'); }, onError: error => showToast(error.message, 'error') });
  async function capture(file?: File, report = false) {
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
      const limit = report ? 60000 : 80000;
      if (result.length > limit) result = canvas.toDataURL('image/jpeg', 0.3);
      if (result.length > limit) throw new Error('Photo is too large. Retake it with lower resolution.');
      if (report) setReportPhoto(result); else setPhoto(result);
    } catch (error) { showToast((error as Error).message, 'error'); }
    finally { URL.revokeObjectURL(url); setPreparing(false); }
  }
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  const merchant = profile.data.merchant; const busy = start.isPending || finish.isPending || preparing;
  const distance = location && merchant.latitude != null && merchant.longitude != null ? visitDistance(location.coords.latitude, location.coords.longitude, Number(merchant.latitude), Number(merchant.longitude)) : null;
  const nearby = !locationError && !!location && clock - location.timestamp < 30000 && canVisit(distance, location.coords.accuracy);
  const time = (date: string) => formatDateTime(date);
  return <div className="dashboard-page"><section className="field-route-planning ae-workflow">
    <Link to={visitMode ? "/field?section=visits" : "/field?section=directory"}>← {visitMode ? uiText("Back to visits") : uiText("Back to merchants")}</Link>
    <header><Store /><div><h1>{!visitMode ? uiText("Merchant Profile") : ownActive ? uiText("Visit Report") : uiText("Check In")}</h1><p>{merchant.name} · {merchant.merchant_code}</p></div></header>
    <article className="attendance-card"><h2>{uiText("Merchant information")}</h2>{merchant.opening_time && merchant.closing_time && <p><Clock size={17} />{uiText(" Shop hours: ")}{formatClockTime(merchant.opening_time)} – {formatClockTime(merchant.closing_time)}{uiText(" (IST)")}{merchant.closing_time < merchant.opening_time ? uiText(" · closes next day") : ''}</p>}<p><MapPin size={17} /> {merchant.address || 'Address not added'}</p>{merchant.phone && <p><Phone size={17} /> <a href={`tel:${merchant.phone}`}>{merchant.phone}</a></p>}<p>{merchant.email}</p>{merchant.image_url && <img src={merchant.image_url} alt={merchant.name} style={{ maxWidth:'100%',maxHeight:220,borderRadius:14 }} />}</article>
    {!profile.data.activityRecorded && <p role="alert">{uiText("Profile-view activity could not be recorded.")}</p>}
    {visitMode && <article className="attendance-card"><h2>{ownActive ? uiText("Visit in progress") : uiText("Check-in location")}</h2>
      {!ownActive && merchant.latitude != null && merchant.longitude != null && <div className="ae-checkin-map"><FieldMerchantMapper merchants={[merchant]} categories={[]} visitPosition={location ? { latitude: location.coords.latitude, longitude: location.coords.longitude } : null} /></div>}
      {ownActive && <div className="ae-visit-clock"><Clock /><div><small>{uiText("Visit in progress")}</small><br /><strong>{new Date(Math.max(0, clock - Date.parse(ownActive.check_in_at))).toISOString().slice(11,19)}</strong></div></div>}
      <div className={`ae-location ${nearby ? '' : 'waiting'}`}><MapPin /><div><strong>{nearby ? uiText("Within 50 m") : uiText("Check-in range required")}</strong><small>{uiText("Visit actions available within 50 metres")}</small></div></div>
      <div className="ae-gps-distance" role="status">{locationError || (distance == null ? uiText("Waiting for GPS location…") : <><strong>{distance.toFixed(1)} <small>{uiText("metres")}</small></strong><span>{uiText("from the merchant")}</span><p>{uiText("GPS accuracy ±")}{Math.ceil(location!.coords.accuracy)} m · {clock - location!.timestamp < 30000 ? uiText("Live reading") : uiText("Waiting for a fresh reading")}</p></>)}</div>
      {!nearby && <p role="alert">{uiText("Visit actions are available only within 50 metres with a fresh, accurate GPS reading. Outside this radius, the visit remains open; it is not ended automatically.")}</p>}
      {history.isPending ? <p>{uiText("Loading visits…")}</p> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()} /> : ownActive ? <><p><Clock size={17} />{uiText(" Started: ")}{time(ownActive.check_in_at)}</p>{ownActive.photos?.[0] && <img src={ownActive.photos[0]} alt={uiText("Shop photo captured for this visit")} style={{ maxWidth:'100%',maxHeight:240 }} />}<label>{uiText("Reason *")}<select required value={reason} onChange={event => setReason(event.target.value)}><option value="">{uiText("Select reason")}</option>{['Merchant request','Usual route visit','Demo and monitoring','Other'].map(item => <option key={item} value={item}>{uiText(item)}</option>)}</select></label><label>{uiText("Description")}<textarea placeholder={uiText("What happened during your visit?")} rows={5} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label><LiveCamera facing="environment" disabled={busy} label={reportPhoto ? 'Retake optional image' : 'Add optional image'} onCapture={file => void capture(file, true)} />{reportPhoto && <><img src={reportPhoto} alt={uiText("Optional visit report image")} className="ae-visit-photo" /><button className="button secondary" onClick={() => setReportPhoto('')}>{uiText("Remove image")}</button></>}<label>{uiText("Challenge status")}<select value={challenge} onChange={event => setChallenge(event.target.value)}>{['Pending','Solved','Escalated to admin team','Follow-up required'].map(item => <option key={item} value={item}>{uiText(item)}</option>)}</select></label>{challenge === 'Follow-up required' && <label>{uiText("Follow-up date *")}<input type="date" required value={followUp} onChange={event => setFollowUp(event.target.value)} /></label>}<label>{uiText("Problems (optional)")}<textarea placeholder={uiText("Any issues faced at the outlet?")} rows={4} maxLength={2000} value={problems} onChange={event => setProblems(event.target.value)} /></label><label>{uiText("Merchant feedback *")}<textarea required placeholder={uiText("Record the merchant’s feedback")} rows={4} maxLength={2000} value={feedback} onChange={event => setFeedback(event.target.value)} /></label><button className="button primary" disabled={busy || !nearby || !reason || !feedback.trim() || (challenge === 'Follow-up required' && !followUp)} onClick={() => setReview(true)}>{busy ? uiText("Saving…") : uiText("Review visit details")}</button></> : active ? <p>{uiText("Finish your current visit before starting another. ")}<Link to={`/field/merchants/${encodeURIComponent(active.merchant_id)}?visit=1`}>{uiText("Open active visit")}</Link></p> : <>
        <p>{uiText("Capture the outlet photo, review it, then Start Visit. GPS must be within 50 metres of the merchant.")}</p>
        <LiveCamera facing="environment" disabled={busy} label={photo ? 'Retake shop photo' : 'Capture shop photo'} onCapture={file => void capture(file)} />
        {photo && <><img src={photo} alt={uiText("Shop photo preview")} style={{ maxWidth:'100%',maxHeight:240,borderRadius:14 }} /><button type="button" className="button secondary" disabled={busy} onClick={() => setPhoto('')}>{uiText("Remove / retake")}</button></>}
        <button className="button primary" disabled={!photo || busy || !nearby} onClick={() => start.mutate()}>{busy ? uiText("Preparing visit…") : uiText("Start Visit")}</button>
        {(merchant.latitude == null || merchant.longitude == null) && <p>{uiText("Merchant GPS location must be added before a visit can start.")}</p>}
      </>}
    </article>}
    <article className="attendance-card"><h2>{uiText("My visits to this merchant")}</h2>{history.data?.visits.filter(visit => visit.merchant_id === id).map(visit => <div className="attendance-request" key={visit.id}><strong>{visit.admin_closed_at ? uiText("Closed by Admin") : visit.status === 'active' ? uiText("In progress") : visit.status}</strong><p>{time(visit.check_in_at)}{visit.check_out_at ? ` — ${time(visit.check_out_at)}` : ''}</p>{visit.admin_closed_at && <p>{uiText("Admin closed: ")}{time(visit.admin_closed_at)} · {visit.admin_close_reason}</p>}<p>{visit.reason || visit.outcome}</p>{visit.challenge_status && <p>{uiText("Challenge: ")}{visit.challenge_status}</p>}{visit.report_image && <img className="ae-visit-photo" src={visit.report_image} alt={uiText("Saved visit report image")} />}<p>{visit.notes}</p>{visit.follow_up_date && <p>{uiText("Follow-up: ")}{visit.follow_up_date}</p>}{visit.problems && <p>{uiText("Problems: ")}{visit.problems}</p>}{visit.feedback && <p>{uiText("Feedback: ")}{visit.feedback}</p>}</div>)}{history.data && !history.data.visits.some(visit => visit.merchant_id === id) && <p>{uiText("No visits recorded yet.")}</p>}</article>
    {review && <div className="modal-backdrop"><div className="modal ae-visit-review" role="dialog" aria-modal="true" aria-labelledby="visit-review-title"><h2 id="visit-review-title">{uiText("Review visit details")}</h2><p>{merchant.name} · {merchant.merchant_code}</p><dl>{[['Reason',reason],['Challenge',challenge || 'None'],['Description',notes],['Problems',problems],['Feedback',feedback],['Follow-up date',followUp]].map(([label,value]) => <div key={label}><dt>{uiText(label)}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>{reportPhoto && <img className="ae-visit-photo" src={reportPhoto} alt={uiText("Report image preview")} />}<p>{nearby ? uiText("Within 50 metres. Ready to submit.") : uiText("Return within 50 metres to submit and end this visit.")}</p><div className="attendance-actions"><button className="button secondary" disabled={busy} onClick={() => setReview(false)}>{uiText("Back to edit")}</button><button className="button primary" disabled={busy || !nearby} onClick={() => finish.mutate()}>{busy ? uiText("Saving…") : uiText("Submit & End Visit")}</button></div></div></div>}
  </section></div>;
}
