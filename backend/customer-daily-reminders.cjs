const crypto=require('node:crypto'),jwt=require('jsonwebtoken'),bank=require('./customer-daily-messages.json');
const ISSUER='https://token.actions.githubusercontent.com',AUDIENCE='ae-customer-daily-reminders',REPOSITORY='t06546666-maker/AE',WORKFLOW=REPOSITORY+'/.github/workflows/customer-daily-reminders.yml@refs/heads/main';
const defaults={pushEnabled:true,whatsappEnabled:true,startDate:bank.rotationStart};
let jwks={until:0,keys:[]};
async function verifyScheduler(token,fetcher=fetch){
 const decoded=jwt.decode(token,{complete:true});if(!decoded||decoded.header.alg!=='RS256'||typeof decoded.header.kid!=='string')throw Error('Invalid scheduler');
 if(Date.now()>jwks.until){const r=await fetcher(ISSUER+'/.well-known/jwks',{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Scheduler unavailable');jwks={until:Date.now()+300000,keys:(await r.json()).keys||[]};}
 const key=jwks.keys.find(k=>k.kid===decoded.header.kid&&k.kty==='RSA');if(!key)throw Error('Unknown scheduler');
 const claims=jwt.verify(token,crypto.createPublicKey({key,format:'jwk'}),{algorithms:['RS256'],issuer:ISSUER,audience:AUDIENCE,maxAge:'10m'});
 if(claims.repository!==REPOSITORY||String(claims.repository_id)!=='1287086199'||claims.ref!=='refs/heads/main'||claims.workflow_ref!==WORKFLOW||claims.sub!=='repo:'+REPOSITORY+':ref:refs/heads/main'||!['schedule','workflow_dispatch'].includes(claims.event_name))throw Error('Untrusted scheduler');return claims;
}
function slotFor(now,preview=false){const ist=new Date(now.getTime()+330*60000),hour=ist.getUTCHours(),date=ist.toISOString().slice(0,10);const slot=hour>=10&&hour<12?'morning':hour>=17&&hour<19?'evening':preview?(hour<17?'morning':'evening'):null;return slot?{date,slot,hour:slot==='morning'?10:17}:null;}
function usedApp(usage){return Boolean(usage?.platforms?.android||Number.isFinite(Date.parse(usage?.lastAndroidSeen||'')));}
function messageFor(customer,usage,current,now){
 const created=Date.parse(customer.created_at||''),last=Date.parse(usage?.lastAndroidSeen||''),points=Number(customer.reward_points);
 const group=Number.isFinite(created)&&now-created<=7*86400000?'new':Number.isFinite(last)&&now-last>30*86400000?'inactive':!usedApp(usage)?'new':Number.isFinite(points)&&points>=100?'ready':Number.isFinite(points)&&points>=0?'earning':'active';
 const day=Math.floor((Date.parse(current.date)-Date.parse(bank.rotationStart))/86400000),index=((day+(current.slot==='evening'?3:0))%7+7)%7;
 return {group,index,title:current.slot==='morning'?'Good morning! ☀️':'Good evening! 💚',body:bank.groups[group][index].replaceAll('{{points}}',Number.isFinite(points)?points.toLocaleString('en-IN',{maximumFractionDigits:2}):'—'),url:'/customer/home'};
}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function processPage({supabase,firestore,getTarget,send,sendUsage,usageReady,now=()=>new Date(),dryRun=false,after=null,forceSlot=null}){
 const current=forceSlot?(()=>{const ist=new Date(now().getTime()+330*60000);return{date:ist.toISOString().slice(0,10),slot:forceSlot,hour:forceSlot==='morning'?10:17};})():slotFor(now(),dryRun);if(!current)return{outsideWindow:true,nextCursor:null};
 const db=await firestore(),saved=await db.collection('ae_customer_daily_settings').doc('main').get(),config={...defaults,...(saved.exists?saved.data():{})};
 if(current.date<config.startDate&&!dryRun)return{notStarted:true,startDate:config.startDate,nextCursor:null};
 let query=supabase.from('customers').select('id,name,phone,created_at,reward_points,whatsapp_enabled').order('id').limit(10);if(after)query=query.gt('id',after);const result=await query;if(result.error)throw result.error;
 const customers=result.data||[],run=db.collection('ae_customer_daily_runs').doc(current.date+'-'+current.slot),counts={pushAccepted:0,whatsappAccepted:0,failed:0,skipped:0,duplicate:0,eligiblePush:0,eligibleWhatsApp:0};
 const approved=current.slot==='morning'&&config.whatsappEnabled?await usageReady().catch(()=>false):false;
 async function delivery(customer,channel,eligible,reason,action,extra={}){
  if(eligible)counts[channel==='push'?'eligiblePush':'eligibleWhatsApp']++;
  if(dryRun){if(!eligible)counts.skipped++;return;}
  const {token,phone,...safeExtra}=extra;
  const record=run.collection('deliveries').doc(customer.id+'-'+channel);
  try{await record.create({customerId:customer.id,channel,status:eligible?'sending':reason,date:current.date,slot:current.slot,createdAt:now().toISOString(),...safeExtra});}catch(e){if(e.code===6||e.code==='already-exists'){counts.duplicate++;return;}throw e;}
  if(!eligible){counts.skipped++;return;}
  const targetKey=hash(channel==='push'?token:phone),claim=db.collection('ae_customer_daily_claims').doc(current.date+'-'+current.slot+'-'+channel+'-'+targetKey);
  // Tokens and phone numbers are never copied into delivery/audit records.
  try{await claim.create({customerId:customer.id,createdAt:now().toISOString()});}catch(e){if(e.code===6||e.code==='already-exists'){await record.update({status:'duplicate'});counts.duplicate++;return;}throw e;}
  let accepted=false;try{accepted=Boolean(await action());}catch{/* Never retry a claimed ambiguous send automatically. */}
  counts[accepted?(channel==='push'?'pushAccepted':'whatsappAccepted'):'failed']++;
  await record.update({status:accepted?'accepted':'failed_or_unconfirmed',updatedAt:now().toISOString()});
 }
 for(let offset=0;offset<customers.length;offset+=5){await Promise.all(customers.slice(offset,offset+5).map(async customer=>{
  const [usageDoc,target]=await Promise.all([db.collection('ae_usage_users').doc(hash('customer:'+customer.id)).get(),getTarget(customer.id)]),usage=usageDoc.exists?usageDoc.data():null,message=messageFor(customer,usage,current,now().getTime());
  const pushEligible=config.pushEnabled&&Boolean(target.push_token)&&target.push_enabled!==false;
  const pushReason=!config.pushEnabled?'paused':target.push_enabled===false?'notifications_off':'no_push_token';
  // Keep private targeting values out of the persisted record.
  const phone=String(customer.phone||'').replace(/\D/g,''),normalized=phone.length===10?'91'+phone:phone;
  const waEligible=current.slot==='morning'&&config.whatsappEnabled&&!usedApp(usage)&&!target.push_token&&customer.whatsapp_enabled===true&&/^\d{10,15}$/.test(normalized)&&approved;
  const waReason=!config.whatsappEnabled?'paused':usedApp(usage)||target.push_token?'app_use_or_registration_recorded':customer.whatsapp_enabled!==true?'whatsapp_not_enabled':!approved?'template_unavailable':'invalid_phone';
  // Claim key is passed separately; only safe metadata reaches the delivery document.
  await delivery(customer,'push',pushEligible,pushReason,()=>send(target.push_token,message.title,message.body,{url:message.url,type:'customer_daily_reminder',date:current.date,slot:current.slot}),{group:message.group,messageIndex:message.index,title:message.title,body:message.body,token:target.push_token||''});
  if(current.slot==='morning')await delivery(customer,'whatsapp',waEligible,waReason,()=>sendUsage(customer,normalized,message),{phone:normalized,template:'ae_customer_update'});
 }));}
 const nextCursor=customers.length===10?customers.at(-1).id:null;
 if(!dryRun)await run.set({date:current.date,slot:current.slot,lastCheckedAt:now().toISOString(),completed:!nextCursor},{merge:true});
 return {...current,dryRun,counts,nextCursor,startDate:config.startDate};
}
function registerCustomerDailyReminders(app,deps){
 const {auth,adminRole,firestore}=deps;
 app.post('/api/internal/firebase-customer-reminders',async(req,res)=>{try{
  const {OAuth2Client}=require('google-auth-library');
  const ticket=await new OAuth2Client().verifyIdToken({idToken:String(req.headers.authorization||'').replace(/^Bearer /,''),audience:'https://www.affiliateae.co.in/api/internal/firebase-customer-reminders'});
  const identity=ticket.getPayload();
  if(!identity?.email_verified||identity.email!=='51093633292-compute@developer.gserviceaccount.com')return res.status(403).json({error:'Untrusted scheduler'});
  if(!['morning','evening'].includes(req.body?.slot)||req.body.after&&!/^[0-9a-f-]{36}$/i.test(req.body.after))return res.status(400).json({error:'Invalid reminder slot or cursor'});
  res.json(await processPage({...deps,forceSlot:req.body.slot,after:req.body.after||null}));
 }catch{res.status(503).json({error:'Firebase reminder run unavailable'});}});
 app.post('/api/internal/customer-daily-reminders',async(req,res)=>{try{const claims=await(deps.verify||verifyScheduler)(String(req.headers.authorization||'').replace(/^Bearer /,'')),dryRun=req.body?.dryRun===true;if(claims.event_name!=='schedule'&&!dryRun)return res.status(403).json({error:'Manual runs must be dry runs.'});const after=req.body?.after;if(after&&!/^[0-9a-f-]{36}$/i.test(after))return res.status(400).json({error:'Invalid cursor.'});res.json(await processPage({...deps,dryRun,after:after||null}));}catch(e){res.status(e.name==='JsonWebTokenError'||e.message?.includes('scheduler')?401:503).json({error:'Customer reminder run unavailable.'});}});
 app.post('/api/admin/customer-daily-reminders/run',auth,adminRole,async(req,res)=>{if(req.body?.confirm!==true||!['morning','evening'].includes(req.body?.slot))return res.status(400).json({error:'Confirm the morning or evening catch-up run.'});try{const result=await processPage({...deps,dryRun:false,forceSlot:req.body.slot});res.json({...result,manualCatchUp:true});}catch{res.status(503).json({error:'Unable to run the customer reminder catch-up.'});}});
 app.get('/api/admin/customer-daily-reminders',auth,adminRole,async(req,res)=>{const date=String(req.query.date||new Date(Date.now()+330*60000).toISOString().slice(0,10));if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:'Invalid date.'});try{const db=await firestore(),settings=await db.collection('ae_customer_daily_settings').doc('main').get();const slots=await Promise.all(['morning','evening'].map(async slot=>{const snap=await db.collection('ae_customer_daily_runs').doc(date+'-'+slot).collection('deliveries').get(),counts={pushAccepted:0,whatsappAccepted:0,failed:0,processing:0,skipped:0};for(const doc of snap.docs){const row=doc.data();if(row.status==='accepted')counts[row.channel==='push'?'pushAccepted':'whatsappAccepted']++;else if(row.status==='sending')counts.processing++;else if(row.status==='failed_or_unconfirmed')counts.failed++;else counts.skipped++;}return{slot,hour:slot==='morning'?10:17,counts,recorded:snap.docs.length>0};}));res.json({rotationMessages:bank.groups,date,settings:{...defaults,...(settings.exists?settings.data():{})},slots,previews:['morning','evening'].map(slot=>({...messageFor({created_at:'2020-01-01',reward_points:200},{platforms:{android:true},lastAndroidSeen:new Date().toISOString()},{date,slot},Date.now()),slot})),whatsappTemplate:'ae_customer_update',whatsappCadence:'daily until app registration is detected'});}catch{res.status(503).json({error:'Unable to load customer reminder status.'});}});
 app.put('/api/admin/customer-daily-reminders/settings',auth,adminRole,async(req,res)=>{if(typeof req.body?.pushEnabled!=='boolean'||typeof req.body?.whatsappEnabled!=='boolean')return res.status(400).json({error:'Choose enabled or paused for both channels.'});try{const db=await firestore();await db.collection('ae_customer_daily_settings').doc('main').set({pushEnabled:req.body.pushEnabled,whatsappEnabled:req.body.whatsappEnabled,updatedAt:new Date().toISOString(),adminId:req.auth.profile.id},{merge:true});res.json({success:true});}catch{res.status(503).json({error:'Unable to save reminder settings.'});}});
}
module.exports={registerCustomerDailyReminders,processPage,slotFor,messageFor,usedApp,verifyScheduler};
