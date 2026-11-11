const crypto=require('node:crypto');
function audienceFor(usage,days,now=Date.now()){
 const stamp=Date.parse(usage?.lastAndroidSeen||'');
 if(!Number.isFinite(stamp))return 'unobserved';
 return stamp>=now-days*86400000?'active':'inactive';
}
function registerCustomerAudiences(app,{auth,adminRole,db,database}){
 app.get('/api/admin/customer-audiences',auth,adminRole,async(req,res)=>{
  res.set('Cache-Control','no-store');
  const audience=String(req.query.audience||'all'),days=Number(req.query.days||30),page=Number(req.query.page||1);
  if(!['all','active','inactive','unobserved','push_ready','push_unavailable'].includes(audience)||![7,14,30,60,90].includes(days)||!Number.isInteger(page)||page<1)return res.status(400).json({error:'Invalid audience filter.'});
  try{
   // Read only safe activity fields. Never return device tokens to the browser.
   const store=await database();
   const [usage,notifications]=await Promise.all([
    store.collection('ae_usage_users').where('role','==','customer').select('actorKey','lastSeen','lastAndroidSeen').get(),
    store.collection('ae_customer_notifications').select('push_token','push_enabled').get()
   ]);
   const used=new Map(usage.docs.map(d=>[d.id,d.data()])),push=new Map(notifications.docs.map(d=>[d.id,d.data()]));
   const records=[],summary={all:0,active:0,inactive:0,unobserved:0,push_ready:0,push_unavailable:0};
   const search=String(req.query.search||'').trim().slice(0,100).toLowerCase(),now=Date.now();
   for(let offset=0;;offset+=1000){
    if(offset>=50000)throw Error('Audience directory exceeds the supported size.');
    const result=await db.from('customers').select('id,customer_code,name,phone,registration_source,merchant_id,created_at').order('id').range(offset,offset+999);
    if(result.error)throw result.error;
    for(const customer of result.data||[]){
     const hash=crypto.createHash('sha256').update('customer:'+customer.id).digest('hex'),activity=used.get(hash),preferences=push.get(customer.id);
     const group=audienceFor(activity,days,now),pushReady=!!preferences?.push_token&&preferences.push_enabled!==false;
     summary.all++;summary[group]++;summary[pushReady?'push_ready':'push_unavailable']++;
     if(audience!=='all'&&audience!==group&&audience!==(pushReady?'push_ready':'push_unavailable'))continue;
     if(search&&![customer.name,customer.customer_code,customer.phone].some(v=>String(v||'').toLowerCase().includes(search)))continue;
     records.push({...customer,audience:group,lastAppActivity:activity?.lastAndroidSeen||null,lastRecordedActivity:activity?.lastSeen||null,pushReady});
    }
    if((result.data||[]).length<1000)break;
   }
   const total=records.length,pageSize=25;
   const pageRows=await require('./customer-onboarding-shops.cjs').withOnboardingShops(db,records.slice((page-1)*pageSize,page*pageSize));
   res.json({records:pageRows,summary,total,page,pageSize,checkedAt:new Date(now).toISOString()});
  }catch{res.status(503).json({error:'Unable to load customer audiences. Please try again.'});}
 });
}
module.exports={registerCustomerAudiences,audienceFor};
