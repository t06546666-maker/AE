const templates = require('./customer-onboarding-templates.cjs');
function registerCustomerGuide(app, {auth, adminRole, db, normalizePhone, sendTemplate, appLink, instagramLink, usageTemplate}) {
 app.post('/api/admin/customers/:id/usage-message', auth, adminRole, async (req,res) => {
  try {
   const requestId=req.body?.requestId;
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId||''))return res.status(400).json({error:'A valid request ID is required.'});
   const customer=await db.from('customers').select('id,phone,whatsapp_enabled').eq('id',req.params.id).maybeSingle();
   if(customer.error)throw customer.error;
   if(!customer.data)return res.status(404).json({error:'Customer not found.'});
   if(customer.data.whatsapp_enabled===false)return res.status(409).json({error:'This customer has disabled WhatsApp messages.'});
   const phone=normalizePhone(customer.data.phone);
   if(!phone || !/^\d{10,15}$/.test(phone))return res.status(400).json({error:'This customer needs a valid phone number.'});
   if(!usageTemplate)return res.status(503).json({error:'The How to use AE template is not configured.'});
   // Reserve before contacting Meta. A retry never sends the same request twice.
   const reservation=await db.from('whatsapp_messages').insert({id:requestId,customer_id:customer.data.id,recipient:phone,template_name:usageTemplate,message_type:'registration',status:'queued'});
   if(reservation.error){
    if(reservation.error.code!=='23505')throw reservation.error;
    const existing=await db.from('whatsapp_messages').select('customer_id,template_name,status').eq('id',requestId).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data?.customer_id!==customer.data.id || existing.data?.template_name!==usageTemplate)return res.status(409).json({error:'This request ID is already in use.'});
    if(['sent','delivered','read'].includes(existing.data.status))return res.json({accepted:true,status:existing.data.status});
    return res.status(409).json({error:existing.data.status==='failed'?'The previous send failed. Start a new send to retry.':'This send is still pending. Check the WhatsApp delivery log before sending again.'});
   }
   const result=await templates.sendCustomerUsage({customer_id:customer.data.id,customer_phone:phone},{sendTemplate:args=>sendTemplate({...args,logId:requestId}),appLink,instagramLink,usageTemplate});
   if(!result.sent){
    await db.from('whatsapp_messages').update({status:'failed',error_message:'Manual customer guide send failed.'}).eq('id',requestId);
    return res.status(502).json({error:'WhatsApp did not accept the guide. Check the delivery log before retrying.'});
   }
   return res.json({accepted:true,status:'sent'});
  } catch {return res.status(503).json({error:'Unable to send the customer guide. Please check the delivery log before retrying.'});}
 });
}
module.exports={registerCustomerGuide};
