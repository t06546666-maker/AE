const {reminder}=require('./merchant-daily-reminders.cjs');
const messages=require('./merchant-reminder-messages.json');
function validDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}
function scanComplete(pages){let cursor='start';const seen=new Set();while(!seen.has(cursor)){seen.add(cursor);const page=pages.find(p=>p.id===cursor);if(!page)return false;if(page.nextCursor===null)return true;if(typeof page.nextCursor!=='string')return false;cursor=page.nextCursor;}return false;}
function summarizeSlot(date,slot,deliveries,pages,now){
 const config=messages[slot],scheduledAt=new Date(Date.parse(date+'T00:00:00Z')+(config.hour*60-330)*60000).toISOString();
 const rows=deliveries.filter(row=>row.slot===slot),acceptedRows=rows.filter(row=>row.status==='accepted');
 const accepted=acceptedRows.length,failed=rows.filter(row=>row.status==='failed_or_unconfirmed').length;
 const pending=rows.filter(row=>!['accepted','failed_or_unconfirmed'].includes(row.status)).length;
 const complete=scanComplete(pages),ran=rows.length>0||pages.length>0;
 const age=now.getTime()-Date.parse(scheduledAt);
 let status=date<messages.rotationStart?'not_scheduled':age<0?'scheduled':age<3600000?'waiting':'no_record';
 if(ran){if(accepted>0)status=complete&&!failed&&!pending?'sent':'partial';else if(pending)status=age>=3600000?'unconfirmed':'processing';else if(failed)status='failed';else status=complete?'no_eligible':'processing';}
 const times=rows.flatMap(row=>[row.created_at,row.updated_at]).concat(pages.map(p=>p.updated_at)).filter(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))).sort();
 const acceptedTimes=acceptedRows.map(row=>row.updated_at||row.created_at).filter(Boolean).sort();
 const variants=[...new Set(rows.map(row=>row.body).filter(body=>typeof body==='string'&&body))];
 return {slot,title:config.title,scheduledAt,status,accepted,failed,pending,complete,
  missingToken:pages.reduce((sum,p)=>sum+Number(p.missingToken||0),0),disabled:pages.reduce((sum,p)=>sum+Number(p.disabled||0),0),
  firstSentAt:acceptedTimes[0]||null,lastSentAt:acceptedTimes.at(-1)||null,lastActivityAt:times.at(-1)||null,
  messages:variants.length?variants:[reminder(new Date(scheduledAt)).body],messageRecorded:variants.length>0};
}
function registerAdminReminderStatus(app,{auth,adminRole,firestore,now=()=>new Date()}){
 app.get('/api/admin/merchant-reminder-status',auth,adminRole,async(req,res)=>{
  res.set('Cache-Control','no-store');
  const instant=now(),today=new Date(instant.getTime()+330*60000).toISOString().slice(0,10),date=req.query.date||today;
  if(!validDate(date)||date>today)return res.status(400).json({error:'Choose a valid date up to today in India time.'});
  try{
   const db=await firestore();
   const delivery=await db.collection('ae_merchant_daily_reminder_deliveries').where('date','==',date).get();
   const rows=delivery.docs.map(doc=>doc.data());
   const slots=await Promise.all(['morning','afternoon','evening'].map(async slot=>{
    const pageSnapshot=await db.collection('ae_merchant_daily_reminder_runs').doc(date+'-'+slot).collection('pages').get();
    return summarizeSlot(date,slot,rows,pageSnapshot.docs.map(doc=>({...doc.data(),id:doc.id})),instant);
   }));
   res.json({date,timeZone:'Asia/Kolkata',checkedAt:instant.toISOString(),slots});
  }catch{return res.status(503).json({error:'Reminder records are unavailable. Sending status could not be verified.'});}
 });
}
module.exports={registerAdminReminderStatus,summarizeSlot,validDate,scanComplete};
