const templateName='ae_puc_partner_expiry_reminder_v1';
function parameters(record,shop){
 const phone=String(record.phone||'').replace(/\D/g,'');
 if(!/^(?:91)?[6-9]\d{9}$/.test(phone))throw Error('A valid Indian customer phone is required.');
 if(record.status!=='completed'||record.consent!==true)throw Error('Customer service-reminder consent is required.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.expiryDate||''))throw Error('A valid certificate expiry is required.');
 const values=[record.name,record.model,record.plate,record.expiryDate.split('-').reverse().join('-'),shop.name,shop.address];
 if(values.some(v=>!String(v||'').trim()))throw Error('Complete customer, vehicle and shop location details first.');
 return {recipient:phone.length===10?'91'+phone:phone,values:values.map(v=>String(v).trim().replace(/[\r\n\t]+/g,' '))};
}

async function sendPushToVehicleCustomer(db, pushCustomer, record, shop) {
 if (!pushCustomer || !db) return false;
 try {
  const cleanPhone = String(record.phone || '').replace(/\D/g, '').slice(-10);
  const { data: cust } = await db.from('customers').select('id').eq('phone', cleanPhone).maybeSingle();
  if (!cust?.id) return false;
  const expiryFormatted = record.expiryDate.split('-').reverse().join('-');
  const pushTitle = 'Vehicle Pollution Certificate Renewal Due';
  const pushBody = `ഹായ് ${record.name}, നിങ്ങളുടെ ${record.model} വാഹനത്തിന്റെ (${record.plate}) Vehicle Pollution Certificate കാലാവധി ${expiryFormatted}-ന് അവസാനിക്കുന്നു. പരിശോധന പുതുക്കുന്നതിനായി ${shop.address}-ലെ ${shop.name} സന്ദർശിക്കുക. — AE PUC Partner`;
  return await pushCustomer(cust.id, pushTitle, pushBody, {
   url: '/customer/home',
   type: 'puc_reminder',
   plate: record.plate,
   expiryDate: record.expiryDate
  });
 } catch {
  return false;
 }
}

function registerPucReminders(app,{db,database,auth,merchantRole,send,resolveTemplate,pushCustomer}){
 app.post('/api/merchant/puc/records/:id/reminder',auth,merchantRole,async(req,res)=>{
  let audit;
  try{
   if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.status(400).json({error:'Invalid vehicle record.'});
   const result=await db.from('active_merchants').select('id,name,address,merchant_categories(name)').eq('id',req.auth.profile.merchant_id).maybeSingle();
   const shop=result.data;
   if(result.error||!shop||!require('./puc-register.cjs').eligibleCategory(shop.merchant_categories?.name))return res.status(403).json({error:'PUC category access required.'});
   const store=await database(),ref=store.collection('ae_puc_shops').doc(shop.id).collection('registrations').doc(req.params.id),doc=await ref.get();
   if(!doc.exists)return res.status(404).json({error:'Vehicle record not found.'});
   let value;try{value=parameters(doc.data(),shop);}catch(e){return res.status(400).json({error:e.message});}
   const template=await resolveTemplate(shop);
   if(!template)return res.status(503).json({error:'The category renewal template is awaiting Meta approval. No message was sent.'});
   audit=ref.collection('reminders').doc(doc.data().expiryDate);
   const previous=await store.runTransaction(async tx=>{const prior=await tx.get(audit);if(prior.exists)return prior.data();tx.set(audit,{status:'sending',templateName:template.name,createdAt:Date.now()});return null;});
   if(previous)return res.status(409).json({error:previous.status==='accepted'?'Reminder already submitted for this certificate.':'Reminder needs review before another attempt.'});
   const sent=await send({merchantId:shop.id,recipient:value.recipient,templateName:template.name,languageCode:template.language,messageType:'puc_reminder',components:[{type:'body',parameters:value.values.map(text=>({type:'text',text}))}]});
   await audit.update({status:sent.sent?'accepted':'needs_review',messageId:sent.messageId||null,updatedAt:Date.now()});
   if(!sent.sent)return res.status(503).json({error:'Reminder could not be confirmed. Check message history before retrying.'});
   void sendPushToVehicleCustomer(db, pushCustomer, doc.data(), shop);
   return res.json({success:true,status:'accepted',message:'WhatsApp accepted the reminder. Delivery is not yet confirmed.'});
  }catch{if(audit)try{await audit.update({status:'needs_review'});}catch{}return res.status(503).json({error:'Reminder could not be confirmed. Check message history before retrying.'});}
 });

 app.post('/api/merchant/puc/records/batch-reminders',auth,merchantRole,async(req,res)=>{
  try{
   const ids=Array.isArray(req.body?.ids)?req.body.ids.slice(0,100):[];
   if(!ids.length)return res.status(400).json({error:'No vehicle records selected.'});
   const result=await db.from('active_merchants').select('id,name,address,merchant_categories(name)').eq('id',req.auth.profile.merchant_id).maybeSingle();
   const shop=result.data;
   if(result.error||!shop||!require('./puc-register.cjs').eligibleCategory(shop.merchant_categories?.name))return res.status(403).json({error:'PUC category access required.'});
   const template=await resolveTemplate(shop);
   if(!template)return res.status(503).json({error:'The category renewal template is awaiting Meta approval. No messages were sent.'});
   const store=await database();
   const shopRef=store.collection('ae_puc_shops').doc(shop.id).collection('registrations');
   let whatsappAccepted=0,pushAccepted=0;
   for(const id of ids){
    if(!/^[a-f0-9]{64}$/.test(id))continue;
    try{
     const doc=await shopRef.doc(id).get();
     if(!doc.exists)continue;
     const rec=doc.data();
     let value;try{value=parameters(rec,shop);}catch{continue;}
     const audit=shopRef.doc(id).collection('reminders').doc(rec.expiryDate);
     const previous=await store.runTransaction(async tx=>{const prior=await tx.get(audit);if(prior.exists&&prior.data().status==='accepted')return prior.data();tx.set(audit,{status:'sending',templateName:template.name,createdAt:Date.now()},{merge:true});return null;});
     if(previous)continue;
     const sent=await send({merchantId:shop.id,recipient:value.recipient,templateName:template.name,languageCode:template.language,messageType:'puc_reminder',components:[{type:'body',parameters:value.values.map(text=>({type:'text',text}))}]});
     await audit.update({status:sent.sent?'accepted':'needs_review',messageId:sent.messageId||null,updatedAt:Date.now()});
     if(sent.sent)whatsappAccepted++;
     const pSent=await sendPushToVehicleCustomer(db,pushCustomer,rec,shop);
     if(pSent)pushAccepted++;
    }catch{}
   }
   return res.json({success:true,processed:ids.length,whatsappAccepted,pushAccepted,message:`Sent ${whatsappAccepted} WhatsApp reminder(s) and ${pushAccepted} Push Notification(s).`});
  }catch{return res.status(500).json({error:'Failed to process batch reminders.'});}
 });
}
module.exports={parameters,registerPucReminders,templateName};
