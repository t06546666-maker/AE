import { useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, MapPin, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api';
import type { UserProfile } from '../types';
import '../field-profile.css';

type Visit = { id: string; merchant_id: string; status: string; check_in_at: string; check_out_at?: string };
export function FieldProfile({ user, visits, merchantCount, loading, error }: { user: UserProfile; visits: Visit[]; merchantCount: number; loading: boolean; error: string | null }) {
  const [tab, setTab] = useState('Personal Details');
  const [period, setPeriod] = useState(30);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - period + 1); start.setHours(0, 0, 0, 0);
  const recent = visits.filter(v => new Date(v.check_in_at) >= start);
  const visited = new Set(visits.map(v => v.merchant_id)).size;
  const days = Array.from({ length: period }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return { date, count: recent.filter(v => new Date(v.check_in_at).toDateString() === date.toDateString()).length }; });
  const max = Math.max(1, ...days.map(d => d.count));
  async function changePassword(event: FormEvent) {
    event.preventDefault(); setMessage(''); setFailed(false);
    if (newPassword !== confirmPassword) { setFailed(true); setMessage('New passwords do not match.'); return; }
    setSaving(true);
    try { await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); setMessage('Password updated successfully.'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : 'Password update failed.'); }
    finally { setSaving(false); }
  }
  return <section className="field-profile"><h1>My Profile</h1><p>View your account, field activity and security settings</p>
    <div className="fpr-overview"><div className="fpr-identity"><span className="fpr-avatar">{(user.full_name || 'Field Manager').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{user.full_name || 'Field Manager'}</strong><small>Field Manager</small><span className="fpr-session">Signed in</span></div></div>
      {[{ label: 'Recorded Visits', value: visits.length, Icon: CalendarDays }, { label: 'Merchants Visited', value: visited, Icon: CheckCircle2 }, { label: 'Merchants Reached', value: `${merchantCount ? Math.round(visited / merchantCount * 100) : 0}%`, Icon: MapPin }].map(({ label, value, Icon }) => <div className="fpr-stat" key={label}><Icon /><div><strong>{value}</strong><small>{label}</small></div></div>)}</div>
    <nav className="fpr-tabs" aria-label="Profile sections">{['Personal Details', 'Work Details', 'Security'].map(label => <button key={label} aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}</nav>
    {tab === 'Personal Details' && <div className="fpr-panel"><h2>Basic Information</h2><dl><div><dt>Full Name</dt><dd>{user.full_name || 'Not provided'}</dd></div><div><dt>Role</dt><dd>Field Manager</dd></div><div><dt>Email</dt><dd>{user.email || 'Not provided'}</dd></div><div><dt>Phone Number</dt><dd>{user.phone || 'Not provided'}</dd></div><div><dt>Account ID</dt><dd>{user.id}</dd></div></dl><p className="fpr-note">Contact Admin to update account details. Employee ID and work location have not been configured.</p></div>}
    {tab === 'Work Details' && <div className="fpr-panel"><h2>Work Details</h2><dl><div><dt>Merchant Access</dt><dd>All merchants ({merchantCount})</dd></div><div><dt>Check-in Radius</dt><dd>150 metres</dd></div><div><dt>Assigned Territory</dt><dd>Not configured</dd></div><div><dt>Work Location</dt><dd>Not provided</dd></div></dl><p className="fpr-note">Merchants Reached measures unique merchants in loaded visit history, not geographic area coverage.</p></div>}
    {tab === 'Security' && <form className="fpr-panel fpr-security" onSubmit={changePassword}><h2><ShieldCheck size={20} /> Change Password</h2><label>Current Password<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label><label>New Password<input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label><small>At least 10 characters, including uppercase, lowercase, a number and a symbol.</small><label>Confirm New Password<input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>{message && <p role={failed ? 'alert' : 'status'} className={failed ? 'form-error' : 'fpr-success'}>{message}</p>}<button disabled={saving}>{saving ? 'Updating…' : 'Update Password'}</button></form>}
    {loading ? <p role="status">Loading activity…</p> : error ? <p role="alert">Activity could not load: {error}</p> : <div className="fpr-performance"><div className="fpr-panel"><header><h2>Performance Summary</h2><select aria-label="Performance period" value={period} onChange={e => setPeriod(Number(e.target.value))}><option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option></select></header><div className="fpr-counts"><div><strong>{recent.length}</strong><small>Total Visits</small></div><div><strong>{recent.filter(v => v.status === 'completed').length}</strong><small>Completed</small></div><div><strong>{recent.filter(v => v.status === 'active').length}</strong><small>In Progress</small></div></div></div><div className="fpr-panel"><h2>Activity</h2><div className="fpr-chart" role="img" aria-label={`Daily visit counts for the last ${period} days: ${days.map(d => `${d.date.toLocaleDateString()}: ${d.count}`).join(', ')}`}>{days.map(d => <span key={d.date.toISOString()} title={`${d.date.toLocaleDateString()}: ${d.count} visits`} style={{ height: `${d.count / max * 100}%` }} />)}</div><small>{start.toLocaleDateString()} — {now.toLocaleDateString()}</small>{!recent.length && <p className="fpr-note">No visits recorded in this period.</p>}</div></div>}
    <p className="fpr-note">Statistics use the loaded visit history (up to 200 records), not lifetime totals.</p>
  </section>;
}
