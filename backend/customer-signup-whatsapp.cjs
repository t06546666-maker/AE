// Self-signup never uses the merchant credential-message workflow.
async function sendSelfSignupWelcome(customer,{queue,sendTemplate,appLink}){
 const purchase={customer_id:customer.id,customer_name:customer.name,customer_phone:customer.phone};
 const queued=await queue(purchase,'registration','welcome');
 if(!queued.queued)return {sent:false,error:queued.error||'Welcome message could not be queued'};
 return sendTemplate({customerId:customer.id,recipient:customer.phone,templateName:'welcome',messageType:'registration',logId:queued.logId,components:[{type:'body',parameters:[{type:'text',text:customer.name},{type:'text',text:appLink}]}]});
}
const shouldSendTemporaryPassword=purchase=>purchase.send_temporary_password===true&&Boolean(purchase.temporary_password);
module.exports={sendSelfSignupWelcome,shouldSendTemporaryPassword};
