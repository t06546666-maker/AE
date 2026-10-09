import { uiText } from '../uiText';
import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

export function LiveCamera({ facing, disabled, label, onCapture }: { facing: 'user' | 'environment'; disabled?: boolean; label: string; onCapture: (file: File) => void }) {
  const [open, setOpen] = useState(false); const [error, setError] = useState(''); const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true; setError(''); setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) { setError('Live camera is unavailable. Use the installed app or an HTTPS browser with camera access.'); return; }
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } } }).then(async media => {
      if (!alive) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; try { await video.current.play(); } catch { if (alive) setError('Camera preview could not start. Close and try again.'); } }
    }).catch(() => { if (alive) setError('Unable to open camera. Allow camera permission and close other apps using it, then retry.'); });
    return () => { alive = false; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  }, [open, facing]);
  function capture() {
    const frame = video.current; if (!frame?.videoWidth || !frame.videoHeight) return;
    const canvas = document.createElement('canvas'); const ratio = Math.min(1, 1000 / Math.max(frame.videoWidth, frame.videoHeight));
    canvas.width = Math.round(frame.videoWidth * ratio); canvas.height = Math.round(frame.videoHeight * ratio);
    const context = canvas.getContext('2d'); if (!context) { setError('Camera capture is unavailable.'); return; }
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (!blob) { setError('Photo capture failed. Retry.'); return; } onCapture(new File([blob], 'ae-camera.jpg', { type: 'image/jpeg' })); setOpen(false); }, 'image/jpeg', .8);
  }
  return <><button type="button" className="button secondary ae-camera-open" disabled={disabled} onClick={() => setOpen(true)}><Camera />{uiText(label)}</button>{open && <div className="modal-backdrop"><div className="modal ae-live-camera" role="dialog" aria-modal="true" aria-label={uiText(label)}><h2>{uiText(label)}</h2><video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} style={{ width: '100%', maxHeight: '55vh', borderRadius: 16, background: '#10214b', transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />{error && <p role="alert">{error}</p>}<div className="attendance-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>{uiText("Cancel")}</button><button type="button" className="button primary" disabled={!ready || !!error} onClick={capture}>{uiText("Take Photo")}</button></div></div></div>}</>;
}
