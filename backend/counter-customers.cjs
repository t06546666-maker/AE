const crypto=require('node:crypto');
// Staff identity and shop come exclusively from the authenticated session.
function registerCounterCustomers(app,{staffAuth,ready,database,onboard}){
 app.post('/api/counter/customers',staffAuth,ready,async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{
   const name=String(req.body.name||'').trim(),phone=String(req.body.phone||'').trim(),amount=String(req.body.amount??'');
   if(!name||name.length>100||!/^\+?\d{10,12}$/.test(phone)||!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount)||Number(amount)<1||req.body.consent!==true)return res.status(400).json({error:'Enter customer name, mobile number, bill amount and customer consent.'});
   const key=req.get('Idempotency-Key');if(!/^[a-zA-Z0-9-]{16,80}$/.test(key||''))return res.status(400).json({error:'Refresh the form before saving.'});
   const db=await database(),root=db.collection('ae_counter_activity').doc(req.counter.merchantId),ref=root.collection('customer_additions').doc(crypto.createHash('sha256').update(req.counter.id+':'+key).digest('hex'));
   const fingerprint=crypto.createHash('sha256').update(JSON.stringify({name,phone,amount})).digest('hex');
   const previous=await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists){if(doc.data().fingerprint!==fingerprint)throw Error('This submission changed. Open a new form.');return doc.data();}tx.set(ref,{status:'processing',staffId:req.counter.id,fingerprint,createdAt:Date.now()});return null;});
   if(previous){if(previous.status==='completed')return res.status(200).json(previous.result);return res.status(409).json({error:'This submission needs merchant review before retrying.'});}
   // Persist the attempt before onboarding. Never replay an uncertain purchase.
   const outcome=await onboard({merchantId:req.counter.merchantId,staffName:req.counter.name,name,phone,amount:Number(amount),requestKey:'counter-add-'+ref.id});
   if(outcome.status>=400||!outcome.body?.success){await ref.update({status:'needs_review'});return res.status(outcome.status>=400?outcome.status:503).json({error:outcome.body?.error||'Could not add customer. Ask the merchant to review.',...(outcome.body?.code==='CUSTOMER_ALREADY_REGISTERED'?{code:'CUSTOMER_ALREADY_REGISTERED'}:{})});}
   const c=outcome.body.customer,result={success:true,customer:{name:c.name,code:c.id,rewardPoints:c.rewardPoints}};
   await db.runTransaction(async tx=>{tx.update(ref,{status:'completed',result,finishedAt:Date.now()});tx.set(root.collection('events').doc(),{action:'customer_added',staffId:req.counter.id,staffName:req.counter.name,actorRole:'counter_staff',customerName:c.name,customerCode:c.id,amount:Number(amount),createdAt:Date.now()});});
   return res.status(201).json(result);
  }catch{return res.status(503).json({error:'Could not complete the submission. Ask the merchant to review before retrying.'});}
 });
}
module.exports={registerCounterCustomers};
