function registerMerchantPushSync(app,{auth,adminRole,supabase,registry}) {
 app.post('/api/admin/merchant-push-sync',auth,adminRole,async(req,res)=>{
  const after=req.body.after;
  if(after!==undefined&&(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(after)))return res.status(400).json({error:'Invalid sync cursor'});
  try {
   // No subscription filter: every existing merchant login is eligible.
   let query=supabase.from('profiles').select('id,push_token,push_enabled').eq('role','merchant').order('id').limit(21);
   if(after)query=query.gt('id',after);
   const result=await query;if(result.error)throw Error('Store login lookup failed');
   const profiles=(result.data||[]).slice(0,20);
   const totals={logins:0,registered:0,disabled:0,needsPhoneRegistration:0};
   for(const profile of profiles){
    const state=await registry.syncLegacy(profile);
    totals.logins++;if(state.registered)totals.registered++;else totals.needsPhoneRegistration++;
    if(!state.enabled)totals.disabled++;
   }
   // No tokens are returned and no notification is sent by syncing.
   res.json({...totals,hasMore:(result.data||[]).length>20,nextCursor:profiles.at(-1)?.id||null});
  }catch{return res.status(503).json({error:'Phone registration sync did not finish. Completed registrations are preserved; retry safely.'});}
 });
}
module.exports={registerMerchantPushSync};
