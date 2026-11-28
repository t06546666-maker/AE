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
  const digits = String(record.phone || '').replace(/\D/g, '');
  const national = digits.slice(-10);
  const candidates = [national, '91' + national, '+91' + national];
  const { data: cust } = await db.from('customers').select('id').in('phone', candidates).maybeSingle();
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
   const channel=String(req.body?.channel||req.query?.channel||'whatsapp').toLowerCase();
   const result=await db.from('active_merchants').select('id,name,address,merchant_categories(name)').eq('id',req.auth.profile.merchant_id).maybeSingle();
   const shop=result.data;
   if(result.error||!shop||!require('./puc-register.cjs').eligibleCategory(shop.merchant_categories?.name))return res.status(403).json({error:'PUC category access required.'});
   const store=await database(),ref=store.collection('ae_puc_shops').doc(shop.id).collection('registrations').doc(req.params.id),doc=await ref.get();
   if(!doc.exists)return res.status(404).json({error:'Vehicle record not found.'});

   if(channel==='push'){
    const pSent=await sendPushToVehicleCustomer(db,pushCustomer,doc.data(),shop);
    return res.json({success:true,status:'accepted',channel:'push',pushed:Boolean(pSent),message:pSent?'App push notification delivered.':'Push notification sent (if customer has AE app installed).'});
   }

   let value;try{value=parameters(doc.data(),shop);}catch(e){return res.status(400).json({error:e.message});}
   const template=await resolveTemplate(shop);
   if(!template)return res.status(503).json({error:'The category renewal template is awaiting Meta approval. No message was sent.'});
   audit=ref.collection('reminders').doc(doc.data().expiryDate);
   const previous=await store.runTransaction(async tx=>{
    const prior=await tx.get(audit);
    if(prior.exists){
     const data=prior.data();
     const elapsed=Date.now()-(data.updatedAt||data.createdAt||0);
     if(data.status==='sending'||elapsed<60000)return data;
    }
    tx.set(audit,{status:'sending',templateName:template.name,createdAt:Date.now(),updatedAt:Date.now()},{merge:true});
    return null;
   });
   if(previous)return res.status(409).json({error:previous.status==='sending'?'Reminder is currently sending. Please wait.':'Reminder was submitted just now. Please wait a minute before sending another.'});
   const sent=await send({merchantId:shop.id,recipient:value.recipient,templateName:template.name,languageCode:template.language,messageType:'puc_reminder',components:[{type:'body',parameters:value.values.map(text=>({type:'text',text}))}]});
   await audit.update({status:sent.sent?'accepted':'needs_review',messageId:sent.messageId||null,updatedAt:Date.now()});
   if(!sent.sent)return res.status(503).json({error:'Reminder could not be confirmed. Check message history before retrying.'});
   if(channel==='all')void sendPushToVehicleCustomer(db,pushCustomer,doc.data(),shop);
   return res.json({success:true,status:'accepted',channel:'whatsapp',message:'WhatsApp accepted the reminder. Delivery is not yet confirmed.'});
  }catch{if(audit)try{await audit.update({status:'needs_review'});}catch{}return res.status(503).json({error:'Reminder could not be confirmed. Check message history before retrying.'});}
 });

 app.post('/api/merchant/puc/records/batch-reminders',auth,merchantRole,async(req,res)=>{
  try{
   const ids=Array.isArray(req.body?.ids)?req.body.ids.slice(0,100):[];
   if(!ids.length)return res.status(400).json({error:'No vehicle records selected.'});
   const channel=String(req.body?.channel||'all').toLowerCase();
   const result=await db.from('active_merchants').select('id,name,address,merchant_categories(name)').eq('id',req.auth.profile.merchant_id).maybeSingle();
   const shop=result.data;
   if(result.error||!shop||!require('./puc-register.cjs').eligibleCategory(shop.merchant_categories?.name))return res.status(403).json({error:'PUC category access required.'});
   let template=null;
   if(channel!=='push'){
    template=await resolveTemplate(shop);
    if(!template)return res.status(503).json({error:'The category renewal template is awaiting Meta approval. No messages were sent.'});
   }
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
     if(channel==='whatsapp'||channel==='all'){
      const audit=shopRef.doc(id).collection('reminders').doc(rec.expiryDate);
      const previous=await store.runTransaction(async tx=>{
        const prior=await tx.get(audit);
        if(prior.exists){
          const data=prior.data();
          const elapsed=Date.now()-(data.updatedAt||data.createdAt||0);
          if(data.status==='accepted'&&elapsed<24*3600*1000)return data;
        }
        tx.set(audit,{status:'sending',templateName:template.name,createdAt:Date.now(),updatedAt:Date.now()},{merge:true});
        return null;
      });
      if(!previous){
       const sent=await send({merchantId:shop.id,recipient:value.recipient,templateName:template.name,languageCode:template.language,messageType:'puc_reminder',components:[{type:'body',parameters:value.values.map(text=>({type:'text',text}))}]});
       await audit.update({status:sent.sent?'accepted':'needs_review',messageId:sent.messageId||null,updatedAt:Date.now()});
       if(sent.sent)whatsappAccepted++;
      }
     }
     if(channel==='push'||channel==='all'){
      const pSent=await sendPushToVehicleCustomer(db,pushCustomer,rec,shop);
      if(pSent)pushAccepted++;
     }
    }catch{}
   }
   let message='';
   if(channel==='whatsapp'){
    message=whatsappAccepted>0?`Sent WhatsApp reminders to ${whatsappAccepted} customer(s).`:'WhatsApp reminders already submitted for selected certificates.';
   }else if(channel==='push'){
    message=`Sent App Push notifications to ${pushAccepted||ids.length} customer(s).`;
   }else{
    message=`Sent ${whatsappAccepted} WhatsApp reminder(s) and ${pushAccepted} Push Notification(s).`;
   }
   return res.json({success:true,processed:ids.length,whatsappAccepted,pushAccepted,channel,message});
  }catch{return res.status(500).json({error:'Failed to process batch reminders.'});}
 });
}
module.exports={parameters,registerPucReminders,templateName};
