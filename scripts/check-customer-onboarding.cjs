// Read-only readiness checks. Never creates users, sends SMS or records consent.
const fs=require('node:fs');
// Pin this production readiness check to the explicitly selected file, never
// mix a staging shell's URL/key into the live database check.
const env=require('dotenv').parse(fs.readFileSync('.env'));
const {createClient}=require('@supabase/supabase-js');
const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Database readiness credentials are unavailable');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
(async()=>{
 const checks=[];
 for(const [name,table,columns] of [['customer signup columns','customers','id,merchant_id,network_id,password_hash,must_change_password,password_reset_at,registration_source'],['legal acceptance table','legal_acceptances','actor_id,actor_role,terms_version,privacy_version,accepted_at']]){
  const r=await db.from(table).select(columns).limit(1);checks.push({name,ready:!r.error,error:r.error?{code:r.error.code,message:r.error.message}:null});
 }
 const network=await db.from('networks').select('id').eq('code','LEGACY-001').maybeSingle();checks.push({name:'self-signup network',ready:!!network.data&&!network.error,error:network.error?.message||null});
 console.log(JSON.stringify({databaseHost:new URL(url).hostname,checks,localLegalFlag:env.LEGAL_ACCEPTANCE_ENABLED||'unset (customer consent is independently required)'},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
