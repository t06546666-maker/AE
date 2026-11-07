const crypto=require('node:crypto');
const jwt=require('jsonwebtoken');
const messages=require('./merchant-reminder-messages.json');
const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='ae-merchant-daily-reminders';
const REPOSITORY='t06546666-maker/AE';
const WORKFLOW=REPOSITORY+'/.github/workflows/merchant-daily-reminders.yml@refs/heads/main';
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
 const slot=Object.keys(messages).find(key=>messages[key]?.hour===hour)||(preview?'morning':null);
 if(!slot)return null;
 const day=Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(messages.rotationStart+'T00:00:00Z'))/86400000);
 const config=messages[slot],index=((day%config.messages.length)+config.messages.length)%config.messages.length;
 return {date,slot,title:config.title,body:config.messages[index],url:config.url};
}
function registerMerchantReminders(app,{supabase,firestore,getTarget,send,verify=verifyScheduler,now=()=>new Date()}){
 app.post('/api/internal/merchant-daily-reminders',async(req,res)=>{
  let claims;
  try{const token=String(req.headers.authorization||'').replace(/^Bearer /,'');claims=await verify(token);}catch{return res.status(401).json({error:'Scheduler authentication required.'});}
  const dryRun=req.body?.dryRun===true;
  // Manual Actions runs are validation only; actual sends require the timed event.
  if(claims.event_name!=='schedule'&&!dryRun)return res.status(403).json({error:'Manual scheduler runs must be dry runs.'});
  const current=reminder(now(),dryRun);
  if(!current)return res.json({outsideWindow:true,nextCursor:null});
  const after=req.body?.after;
  if(after&&!/^[0-9a-f-]{36}$/i.test(after))return res.status(400).json({error:'Invalid page cursor.'});
  try{
   let query=supabase.from('active_merchants').select('id').order('id').limit(20);if(after)query=query.gt('id',after);
   const shops=await query;if(shops.error)throw shops.error;
   const ids=(shops.data||[]).map(shop=>shop.id);
   const counts={accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0};
   if(!ids.length)return res.json({dryRun,...current,counts,nextCursor:null});
   const profiles=await supabase.from('profiles').select('id,merchant_id,push_token,push_enabled').eq('role','merchant').in('merchant_id',ids);
   if(profiles.error)throw profiles.error;
   const db=await firestore(),seen=new Set();
   for(const profile of profiles.data||[]){
    const target=await getTarget(profile.id,profile);
    if(target.push_enabled===false){counts.disabled++;continue;}
    if(!target.push_token){counts.missingToken++;continue;}
    const key=crypto.createHash('sha256').update(target.push_token).digest('hex');
    if(seen.has(key)){counts.duplicate++;continue;}seen.add(key);counts.eligible++;
    if(dryRun)continue;
    const ref=db.collection('ae_merchant_daily_reminder_deliveries').doc(current.date+'-'+current.slot+'-'+key);
    try{await ref.create({date:current.date,slot:current.slot,profile_id:profile.id,merchant_id:profile.merchant_id,status:'sending',created_at:now().toISOString()});}
    catch(error){if(error.code===6||error.code==='already-exists'){counts.duplicate++;continue;}throw error;}
    let accepted=false;
    try{accepted=await send(target.push_token,current.title,current.body,{url:current.url,type:'merchant_daily_reminder',slot:current.slot,date:current.date});}
    catch{/* A claimed send is never automatically repeated after ambiguous failure. */}
    counts[accepted?'accepted':'failed']++;
    await ref.set({status:accepted?'accepted':'failed_or_unconfirmed',updated_at:now().toISOString()},{merge:true});
   }
   const nextCursor=ids.length===20?ids[ids.length-1]:null;
   if(!dryRun)await db.collection('ae_merchant_daily_reminder_runs').doc(current.date+'-'+current.slot).collection('pages').doc(after||'start').set({...counts,updated_at:now().toISOString(),nextCursor});
   return res.json({dryRun,...current,counts,nextCursor});
  }catch(error){console.warn('Merchant daily reminder run failed:',error.code||'unavailable');return res.status(503).json({error:'Merchant reminder run failed. Inspect the server delivery log before retrying.'});}
 });
}
module.exports={registerMerchantReminders,reminder,verifyScheduler};
