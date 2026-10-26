function registerMerchantPushDiagnostics(app,{auth,merchantRole,supabase,ready,send,getTarget}) {
 const attempts=new Map();
 async function target(req){
  const result=await supabase.from('profiles').select('push_token,push_enabled').eq('id',req.auth.profile.id).single();
  if(result.error||!result.data)throw Error('Phone registration unavailable');
  return getTarget ? getTarget(req.auth.profile.id,result.data) : result.data;
 }
 app.get('/api/merchant/push-status',auth,merchantRole,async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{const profile=await target(req);res.json({registered:!!profile.push_token,enabled:profile.push_enabled!==false,firebaseReady:await ready()});}
  catch{return res.status(503).json({error:'Could not check phone notification setup. Please retry.'});}
 });
 app.post('/api/merchant/push-test',auth,merchantRole,async(req,res)=>{
  try{
   const profile=await target(req);
   if(!profile.push_token)return res.status(409).json({error:'This account has no registered phone. Open the installed AE app and choose Connect phone notifications.'});
   if(profile.push_enabled===false)return res.status(409).json({error:'Notifications are disabled for this account. Connect phone notifications first.'});
   if(!await ready())return res.status(503).json({error:'The notification server is unavailable. Please contact support.'});
   const now=Date.now(),id=req.auth.profile.id;
   for(const [key,time] of attempts)if(now-time>=60000)attempts.delete(key);
   if(attempts.has(id))return res.status(429).json({error:'Wait one minute before sending another test.'});
   attempts.set(id,now);
   const accepted=await send(profile.push_token,'AE checkout notifications','Your phone is connected. Tap to open checkout requests.',{url:'/shop-checkout',type:'merchant_push_test'});
   if(!accepted)return res.status(502).json({error:'Firebase did not accept the test. Reconnect phone notifications and retry.'});
   return res.json({accepted:true,message:'Firebase accepted the test. Check your phone notification tray; acceptance does not confirm delivery.'});
  }catch{return res.status(503).json({error:'Could not send the test notification. Please retry.'});}
 });
}
module.exports={registerMerchantPushDiagnostics};
