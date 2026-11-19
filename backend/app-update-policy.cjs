const BUCKET='app-config',FILE='app-update-policy.json';
const STORE_URL='https://play.google.com/store/apps/details?id=com.affiliateae.app';
function cleanPolicy(value={}){
 const enabled=value.enabled??false,minimumBuild=value.minimumBuild??0;
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(minimumBuild)||minimumBuild<0||minimumBuild>1000000000||enabled&&minimumBuild<1)throw Error('Choose a valid minimum Android build number.');
 return {enabled,minimumBuild,storeUrl:STORE_URL};
}
function registerAppUpdatePolicy(app,{supabase,auth,adminRole}){
 async function read(){const result=await supabase.storage.from(BUCKET).download(FILE);if(result.error){if(Number(result.error.statusCode||result.error.status)===404||/not.?found/i.test(result.error.message||''))return cleanPolicy();throw Error('Update settings are temporarily unavailable.');}return cleanPolicy(JSON.parse(await result.data.text()));}
 app.get('/api/app-update-policy',async(req,res)=>{res.set('Cache-Control','no-store');try{res.json({policy:await read()});}catch(e){res.status(503).json({error:e.message});}});
 app.get('/api/admin/app-update-policy',auth,adminRole,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json({policy:await read()});}catch(e){res.status(503).json({error:e.message});}});
 app.put('/api/admin/app-update-policy',auth,adminRole,async(req,res)=>{try{const policy=cleanPolicy(req.body);if(policy.enabled&&req.body.releaseAvailable!==true)return res.status(400).json({error:'Confirm the required release is publicly available on Google Play before enabling this requirement.'});const record={...policy,updatedAt:new Date().toISOString(),updatedBy:req.auth.profile.id};const result=await supabase.storage.from(BUCKET).upload(FILE,Buffer.from(JSON.stringify(record)),{contentType:'application/json',cacheControl:'0',upsert:true});if(result.error)throw Error('Could not save update settings.');res.set('Cache-Control','no-store');res.json({policy});}catch(e){res.status(400).json({error:e.message});}});
}
module.exports={registerAppUpdatePolicy,cleanPolicy,STORE_URL};
