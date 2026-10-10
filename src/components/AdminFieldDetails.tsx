import { Link } from 'react-router-dom';
import { initials } from '../utils';
import { uiText } from '../uiText';
import { AdminFieldHistory } from './AdminFieldHistory';
import '../admin-directory.css';
export function AdminFieldDetails({id,data}:{id:string;data:Record<string,any>}){
 const profile=data.profile;
 return <div className="admin-directory-page"><Link className="button secondary" to="/field-managers">{uiText('Back to Field Managers')}</Link><header className="admin-detail-heading"><span className="admin-directory-avatar">{initials(profile.full_name || '')}</span><div><h1>{profile.full_name}</h1><p>{profile.email || '—'} · {profile.phone || uiText('Phone not provided')}</p></div></header><div className="admin-directory-metrics"><article><span>{uiText('Merchants onboarded (all time)')}</span><strong>{data.onboardedTotal??'—'}</strong></article><article><span>{uiText('Visits in profile snapshot')}</span><strong>{data.visits?.length??'—'}</strong></article><article><span>{uiText('Attendance days loaded')}</span><strong>{data.attendanceAvailable?data.attendance?.length:'—'}</strong></article></div><p className="admin-directory-note">{uiText('Profile snapshot counts cover up to 200 records. Use the history tabs below to browse all records.')}</p><AdminFieldHistory id={id}/></div>;
}
