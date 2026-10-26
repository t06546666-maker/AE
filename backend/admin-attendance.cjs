const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function registerAdminAttendance(app,{auth,adminRole,db,workDate}){
 const columns='id,work_date,started_at,ended_at,admin_started_by,admin_started_at,admin_start_reason,admin_ended_by,admin_ended_at,admin_end_reason';
 app.get('/api/admin/field-managers/:id/attendance-control',auth,adminRole,async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!uuid(req.params.id))return res.status(400).json({error:'Invalid manager ID'});
  const profile=await db.from('profiles').select('id').eq('id',req.params.id).eq('role','field_manager').maybeSingle();
  if(profile.error)return res.status(503).json({error:'Attendance controls unavailable.'});
  if(!profile.data)return res.status(404).json({error:'Field manager not found'});
  const day=workDate();
  const rows=await db.from('field_attendance').select(columns).eq('manager_id',req.params.id).or(`work_date.eq.${day},ended_at.is.null`).order('started_at',{ascending:false});
  if(rows.error)return res.status(503).json({error:'Attendance controls require the attendance admin database update.'});
  res.json({today:day,active:rows.data.find(row=>!row.ended_at)||null,todayRecorded:rows.data.some(row=>row.work_date===day)});
 });
 for(const action of ['start','end'])app.post(`/api/admin/field-managers/:id/attendance/force-${action}`,auth,adminRole,async(req,res)=>{
  const reason=typeof req.body.reason==='string'?req.body.reason.trim():'';
  if(!uuid(req.params.id)||reason.length<5||reason.length>2000||(action==='end'&&!uuid(req.body.attendanceId)))return res.status(400).json({error:'Select an active attendance record and enter a reason of 5–2000 characters.'});
  const result=await db.rpc('admin_field_attendance_action',{p_admin:req.auth.profile.id,p_manager:req.params.id,p_action:action,p_reason:reason,p_attendance:action==='end'?req.body.attendanceId:null});
  if(result.error){const code=result.error.code;return res.status(code==='23505'?409:code==='42501'?403:code==='P0002'?404:503).json({error:code==='23505'?'Attendance has already changed. Refresh before trying again.':code==='42501'?'Admin access required.':code==='P0002'?'Field manager not found.':'Attendance override could not be saved. Check database setup and refresh before retrying.'});}
  res.status(action==='start'?201:200).json({attendance:result.data});
 });
}
module.exports={registerAdminAttendance};
