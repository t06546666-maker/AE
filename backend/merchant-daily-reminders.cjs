const crypto=require('node:crypto');
const jwt=require('jsonwebtoken');
const messages=require('./merchant-reminder-messages.json');
const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='ae-merchant-daily-reminders';
const REPOSITORY='t06546666-maker/AE';
const WORKFLOW=REPOSITORY+'/.github/workflows/merchant-daily-reminders.yml@refs/heads/main';
const DEFAULT_CRON_KEY='ae-merchant-reminder-cron-2026';
let keyCache={until:0,keys:[]};

async function verifyScheduler(token,fetcher=fetch){
 const decoded=jwt.decode(token,{complete:true});
 if(!decoded||decoded.header.alg!=='RS256'||typeof decoded.header.kid!=='string')throw Error('Invalid scheduler');
 if(Date.now()>keyCache.until){const response=await fetcher(ISSUER+'/.well-known/jwks',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Scheduler keys unavailable');const data=await response.json();keyCache={until:Date.now()+300000,keys:data.keys||[]};}
 const jwk=keyCache.keys.find(key=>key.kid===decoded.header.kid&&key.kty==='RSA');if(!jwk)throw Error('Unknown scheduler key');
 const claims=jwt.verify(token,crypto.createPublicKey({key:jwk,format:'jwk'}),{algorithms:['RS256'],issuer:ISSUER,audience:AUDIENCE,maxAge:'10m'});
 if(claims.repository!==REPOSITORY||String(claims.repository_id)!=='1287086199'||claims.ref!=='refs/heads/main'||claims.workflow_ref!==WORKFLOW||claims.sub!=='repo:'+REPOSITORY+':ref:refs/heads/main'||!['schedule','workflow_dispatch'].includes(claims.event_name))throw Error('Untrusted scheduler');
 return claims;
}

function reminder(now=new Date(),preview=false){
 const ist=new Date(now.getTime()+330*60000),hour=ist.getUTCHours(),date=ist.toISOString().slice(0,10);
 const slot=hour>=21?null:['evening','afternoon','morning'].find(key=>hour>=messages[key].hour);
 const selected=slot||(preview?'morning':null);
 if(!selected||(!preview&&date<messages.rotationStart))return null;
 const day=Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(messages.rotationStart+'T00:00:00Z'))/86400000);
 const config=messages[selected],index=((day%config.messages.length)+config.messages.length)%config.messages.length;
 return {date,slot:selected,title:config.title,body:config.messages[index],url:config.url};
}

async function processReminderPage({ supabase, db, run, getTarget, send, current, after, dryRun, now }){
 let query=supabase.from('active_merchants').select('id').order('id').limit(20);
 if(after)query=query.gt('id',after);
 const shops=await query;
 if(shops.error)throw shops.error;
 const ids=(shops.data||[]).map(shop=>shop.id);
 const counts={accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0};
 if(!ids.length){
  if(!dryRun){
   await run.collection('pages').doc(after||'start').set({...counts,updated_at:now().toISOString(),nextCursor:null});
   await run.set({completed:true,finished_at:now().toISOString()},{merge:true});
  }
  return {dryRun,...current,counts,nextCursor:null};
 }
 const profiles=await supabase.from('profiles').select('id,merchant_id,push_token,push_enabled').eq('role','merchant').in('merchant_id',ids);
 if(profiles.error)throw profiles.error;
 const seen=new Set();
 for(const profile of profiles.data||[]){
  const target=await getTarget(profile.id,profile);
  if(target.push_enabled===false){counts.disabled++;continue;}
  if(!target.push_token){counts.missingToken++;continue;}
  const key=crypto.createHash('sha256').update(target.push_token).digest('hex');
  if(seen.has(key)){counts.duplicate++;continue;}seen.add(key);counts.eligible++;
  if(dryRun)continue;
  const ref=db.collection('ae_merchant_daily_reminder_deliveries').doc(current.date+'-'+current.slot+'-'+key);
  try{await ref.create({date:current.date,slot:current.slot,profile_id:profile.id,merchant_id:profile.merchant_id,status:'sending',title:current.title,body:current.body,created_at:now().toISOString()});}
  catch(error){if(error.code===6||error.code==='already-exists'){counts.duplicate++;continue;}throw error;}
  let accepted=false;
  try{accepted=await send(target.push_token,current.title,current.body,{url:current.url,type:'merchant_daily_reminder',slot:current.slot,date:current.date});}
  catch{/* A claimed send is never automatically repeated after ambiguous failure. */}
  counts[accepted?'accepted':'failed']++;
  await ref.set({status:accepted?'accepted':'failed_or_unconfirmed',updated_at:now().toISOString()},{merge:true});
 }
 const nextCursor=ids.length===20?ids[ids.length-1]:null;
 if(!dryRun){
  await run.collection('pages').doc(after||'start').set({...counts,updated_at:now().toISOString(),nextCursor});
  if(!nextCursor)await run.set({completed:true,finished_at:now().toISOString()},{merge:true});
 }
 return {dryRun,...current,counts,nextCursor};
}

async function runFullReminderQueue({ supabase, firestore, getTarget, send, now=()=>new Date(), dryRun=false }){
 const current=reminder(now(),dryRun);
 if(!current)return {outsideWindow:true,nextCursor:null,counts:{accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0}};
 const db=await firestore(),run=db.collection('ae_merchant_daily_reminder_runs').doc(current.date+'-'+current.slot);
 if(!dryRun){
  const previous=await run.get();
  if(previous.exists&&previous.data().completed===true)return {...current,alreadyCompleted:true,nextCursor:null,counts:{accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0}};
 }
 let after=null,pages=0;
 const totalCounts={accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0};
 do{
  const result=await processReminderPage({supabase,db,run,getTarget,send,current,after,dryRun,now});
  for(const k of Object.keys(totalCounts))totalCounts[k]+=result.counts[k]||0;
  after=result.nextCursor;
  pages++;
  if(pages>=500&&after)break;
 }while(after);
 return {dryRun,...current,counts:totalCounts,pages,nextCursor:null};
}

let activeSchedulerTimer=null;
let schedulerBusy=false;

function startServerReminderScheduler({ supabase, firestore, getTarget, send, intervalMs=30000, now=()=>new Date() }){
 if(activeSchedulerTimer)return activeSchedulerTimer;
 const tick=async()=>{
  if(schedulerBusy)return;
  const current=reminder(now());
  if(!current)return;
  try{
   const db=await firestore();
   const run=db.collection('ae_merchant_daily_reminder_runs').doc(current.date+'-'+current.slot);
   const snapshot=await run.get();
   if(snapshot.exists&&snapshot.data().completed===true)return;
   if(snapshot.exists&&snapshot.data().in_progress===true){
    const started=Date.parse(snapshot.data().started_at||'');
    if(Number.isFinite(started)&&Date.now()-started<300000)return;
   }
   schedulerBusy=true;
   console.log(`[Daily Reminder Queue] ⏰ Auto-triggering ${current.slot} reminder (${current.date}) on schedule...`);
   await run.set({in_progress:true,started_at:now().toISOString()},{merge:true});
   const summary=await runFullReminderQueue({supabase,firestore,getTarget,send,now,dryRun:false});
   console.log(`[Daily Reminder Queue] ✓ Finished ${current.slot} reminder run:`,JSON.stringify(summary.counts));
  }catch(err){
   console.warn('[Daily Reminder Queue] Tick encountered issue:',err.message||err);
  }finally{
   schedulerBusy=false;
  }
 };
 activeSchedulerTimer=setInterval(tick,intervalMs);
 if(activeSchedulerTimer.unref)activeSchedulerTimer.unref();
 setTimeout(tick,3000);
 return activeSchedulerTimer;
}

function registerMerchantReminders(app,{supabase,firestore,getTarget,send,verify=verifyScheduler,now=()=>new Date()}){
 app.post('/api/internal/merchant-daily-reminders',async(req,res)=>{
  let claims;
  const authHeader=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const cronKeyHeader=(req.headers&&req.headers['x-cron-key'])||req.query?.key;
  const configuredCronKey=process.env.CRON_SECRET||DEFAULT_CRON_KEY;

  if(cronKeyHeader&&cronKeyHeader===configuredCronKey){
   claims={event_name:'schedule',source:'cloud_queue'};
  }else{
   try{claims=await verify(authHeader);}catch{return res.status(401).json({error:'Scheduler authentication required.'});}
  }

  const dryRun=req.body?.dryRun===true;
  if(claims.event_name!=='schedule'&&!dryRun)return res.status(403).json({error:'Manual scheduler runs must be dry runs.'});

  // If fullRun requested by cloud scheduler or webhook, run the entire queue across all pages
  if(req.body?.fullRun===true){
   try{
    const summary=await runFullReminderQueue({supabase,firestore,getTarget,send,now,dryRun});
    return res.json(summary);
   }catch(err){
    console.warn('Full reminder run failed:',err.message||err);
    return res.status(503).json({error:'Merchant reminder queue failed.'});
   }
  }

  const current=reminder(now(),dryRun);
  if(!current)return res.json({outsideWindow:true,nextCursor:null});
  const after=req.body?.after;
  if(after&&!/^[0-9a-f-]{36}$/i.test(after))return res.status(400).json({error:'Invalid page cursor.'});

  try{
   const db=await firestore(),run=db.collection('ae_merchant_daily_reminder_runs').doc(current.date+'-'+current.slot);
   if(!dryRun){
    const previous=await run.get();
    if(previous.exists&&previous.data().completed===true)return res.json({...current,alreadyCompleted:true,nextCursor:null,counts:{accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0}});
   }
   const pageResult=await processReminderPage({supabase,db,run,getTarget,send,current,after,dryRun,now});
   return res.json(pageResult);
  }catch(error){
   console.warn('Merchant daily reminder run failed:',error.code||'unavailable');
   return res.status(503).json({error:'Merchant reminder run failed. Inspect the server delivery log before retrying.'});
  }
 });
}

module.exports={registerMerchantReminders,reminder,verifyScheduler,runFullReminderQueue,startServerReminderScheduler};
