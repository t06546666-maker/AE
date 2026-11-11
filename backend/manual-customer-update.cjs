const crypto=require('node:crypto');
const BODY='ഹായ് {{1}},\n\nനിങ്ങളുടെ AE പോയിന്റ് ബാലൻസ്: {{2}}\n{{3}}\n\n— AE';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function normalizeMessage(value){return typeof value==='string'?value.replace(/\s+/g,' ').trim():'';}
function templateValid(template,name){return template?.name===name&&template.language==='ml'&&template.components?.length===1&&template.components[0].type==='BODY'&&template.components[0].text?.replace(/\r\n/g,'\n')===BODY;}
function recipient(customer,normalizePhone){
 const phone=normalizePhone(customer.phone),points=Number(customer.reward_points);
 return {id:customer.id,name:String(customer.name||'Customer'),points:Number.isFinite(points)&&points>=0?points:null,eligible:customer.whatsapp_enabled!==false&&/^\d{10,15}$/.test(phone||'')&&Number.isFinite(points)&&points>=0,phone};
}
function registerManualCustomerUpdate(app,{auth,adminRole,db,database,normalizePhone,sendTemplate,templateName,inspectTemplate}){
 let cached=null,expires=0;
 async function state(){if(cached&&Date.now()<expires)return cached;const data=await inspectTemplate();cached={name:templateName,status:data.status||'UNKNOWN',category:data.category||null,language:data.language||null,body:BODY,compatible:templateValid(data,templateName)};expires=Date.now()+30000;return cached;}
 app.get('/api/admin/customer-update/template',auth,adminRole,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await state());}catch{res.status(503).json({error:'Unable to check the WhatsApp template approval. No messages have been sent.'});}});
 app.post('/api/admin/customer-update/preview',auth,adminRole,async(req,res)=>{
  const ids=Array.isArray(req.body?.customerIds)?[...new Set(req.body.customerIds)]:[];
  if(!ids.length||ids.length>1000||ids.some(id=>!UUID.test(id)))return res.status(400).json({error:'Select between 1 and 1,000 valid customers.'});
  try{const result=await db.from('customers').select('id,name,phone,reward_points,whatsapp_enabled').in('id',ids);if(result.error)throw result.error;res.json({recipients:(result.data||[]).map(c=>{const {phone,...safe}=recipient(c,normalizePhone);return safe;})});}catch{res.status(503).json({error:'Unable to load current customer balances.'});}
 });
 app.post('/api/admin/customers/:id/account-update',auth,adminRole,async(req,res)=>{
  const message=normalizeMessage(req.body?.message),requestId=req.body?.requestId,id=req.params.id;
  if(!UUID.test(id)||!UUID.test(requestId||'')||!message||message.length>700)return res.status(400).json({error:'Provide a valid customer, request ID and account-update message (up to 700 characters).'});
  try{
   const template=await state();
   if(template.status!=='APPROVED'||!template.compatible)return res.status(409).json({error:'This Malayalam template must be approved by Meta with the matching three fields before sending.'});
   const result=await db.from('customers').select('id,name,phone,reward_points,whatsapp_enabled').eq('id',id).maybeSingle();if(result.error)throw result.error;if(!result.data)return res.status(404).json({error:'Customer not found.'});
   const customer=recipient(result.data,normalizePhone);if(!customer.eligible)return res.status(409).json({error:'This customer has WhatsApp disabled, an invalid phone number or an unavailable points balance.'});
   const digest=crypto.createHash('sha256').update(JSON.stringify({id,message,templateName})).digest('hex'),store=await database(),ref=store.collection('ae_manual_customer_updates').doc(requestId);
   const previous=await store.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists)return snap.data();tx.set(ref,{customerId:id,digest,status:'queued',templateName,createdAt:new Date().toISOString(),adminId:req.auth?.profile?.id||null});return null;});
   if(previous){if(previous.digest!==digest)return res.status(409).json({error:'This request ID belongs to a different message.'});if(previous.status==='sent')return res.json({accepted:true,status:'sent',duplicate:true});return res.status(409).json({error:'This request was already attempted. Check the WhatsApp delivery log before trying again.'});}
   const log=await db.from('whatsapp_messages').insert({id:requestId,customer_id:id,recipient:customer.phone,template_name:templateName,message_type:'announcement',status:'queued'});
   if(log.error){await ref.update({status:'failed'});throw log.error;}
   const sent=await sendTemplate({customerId:id,recipient:customer.phone,templateName,languageCode:'ml',messageType:'announcement',logId:requestId,components:[{type:'body',parameters:[customer.name,customer.points.toLocaleString('en-IN',{maximumFractionDigits:2}),message].map(text=>({type:'text',text}))}]});
   await ref.update({status:sent?.sent?'sent':'failed',points:customer.points,updatedAt:new Date().toISOString()});
   if(!sent?.sent){await db.from('whatsapp_messages').update({status:'failed',error_message:'Manual account update was not accepted.'}).eq('id',requestId);return res.status(502).json({error:'WhatsApp did not confirm acceptance. Check the delivery log before retrying.'});}
   res.json({accepted:true,status:'sent'});
  }catch{res.status(503).json({error:'Unable to confirm this send. Check the WhatsApp delivery log before retrying.'});}
 });
}
module.exports={registerManualCustomerUpdate,normalizeMessage,templateValid,recipient,BODY};
