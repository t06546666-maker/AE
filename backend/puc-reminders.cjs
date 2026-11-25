const templateName='ae_vehicle_pollution_expiry_reminder';
function parameters(record,shop){
 const phone=String(record.phone||'').replace(/\D/g,'');
 if(!/^(?:91)?[6-9]\d{9}$/.test(phone))throw Error('A valid Indian customer phone is required.');
 if(record.status!=='completed'||record.consent!==true)throw Error('Customer service-reminder consent is required.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.expiryDate||''))throw Error('A valid certificate expiry is required.');
 const values=[record.name,record.model,record.plate,record.expiryDate.split('-').reverse().join('-'),shop.name,shop.address];
 if(values.some(v=>!String(v||'').trim()))throw Error('Complete customer, vehicle and shop location details first.');
 return {recipient:phone.length===10?'91'+phone:phone,values:values.map(v=>String(v).trim().replace(/[\r\n\t]+/g,' '))};
}
function registerPucReminders(app,{db,database,auth,merchantRole,send}){
 app.post('/api/merchant/puc/records/:id/reminder',auth,merchantRole,async(req,res)=>{
  let audit;
  try{
   if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.status(400).json({error:'Invalid vehicle record.'});
   const result=await db.from('active_merchants').select('id,name,address,merchant_categories(name)').eq('id',req.auth.profile.merchant_id).maybeSingle();
   const shop=result.data;
   if(result.error||!shop||!require('./puc-register.cjs').eligibleCategory(shop.merchant_categories?.name)||!/pitstop/i.test(shop.name))return res.status(403).json({error:'This PITSTOP renewal template is unavailable for this shop.'});
   const store=await database(),ref=store.collection('ae_puc_shops').doc(shop.id).collection('registrations').doc(req.params.id),doc=await ref.get();
   if(!doc.exists)return res.status(404).json({error:'Vehicle record not found.'});
   let value;try{value=parameters(doc.data(),shop);}catch(e){return res.status(400).json({error:e.message});}
   audit=ref.collection('reminders').doc(doc.data().expiryDate);
   const previous=await store.runTransaction(async tx=>{const prior=await tx.get(audit);if(prior.exists)return prior.data();tx.set(audit,{status:'sending',templateName,createdAt:Date.now()});return null;});
   if(previous)return res.status(409).json({error:previous.status==='accepted'?'Reminder already submitted for this certificate.':'Reminder needs review before another attempt.'});
   const sent=await send({merchantId:shop.id,recipient:value.recipient,templateName,languageCode:'en',messageType:'puc_reminder',components:[{type:'body',parameters:value.values.map(text=>({type:'text',text}))}]});
   await audit.update({status:sent.sent?'accepted':'needs_review',messageId:sent.messageId||null,updatedAt:Date.now()});
   if(!sent.sent)return res.status(503).json({error:'Reminder could not be confirmed. Check message history before retrying.'});
   return res.json({success:true,status:'accepted',message:'WhatsApp accepted the reminder. Delivery is not yet confirmed.'});
  }catch{if(audit)try{await audit.update({status:'needs_review'});}catch{}return res.status(503).json({error:'Reminder could not be confirmed. Check message history before retrying.'});}
 });
}
module.exports={parameters,registerPucReminders,templateName};
