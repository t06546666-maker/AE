// Self-signup never uses the merchant credential-message workflow.
const templates=require('./customer-onboarding-templates.cjs');
async function sendSelfSignupWelcome(customer,{queue,sendTemplate,appLink,instagramLink=templates.INSTAGRAM_LINK,welcomeTemplate=templates.WELCOME_TEMPLATE,usageTemplate=templates.USAGE_TEMPLATE}){
 const purchase={customer_id:customer.id,customer_name:customer.name,customer_phone:customer.phone};
 const queued=await queue(purchase,'registration',welcomeTemplate);
 if(!queued.queued)return {sent:false,error:queued.error||'Welcome message could not be queued'};
 let welcome;
 try{welcome=await sendTemplate({customerId:customer.id,recipient:customer.phone,templateName:welcomeTemplate,messageType:'registration',languageCode:'en',logId:queued.logId,components:templates.welcomeComponents(welcomeTemplate,customer.name,appLink,instagramLink)});}
 catch{welcome={sent:false,error:'Customer welcome message could not be sent.'};}
 const usage=await templates.sendCustomerUsage(purchase,{sendTemplate,appLink,instagramLink,usageTemplate});
 return {...welcome,usage};
}
const shouldSendTemporaryPassword=purchase=>purchase.send_temporary_password===true&&Boolean(purchase.temporary_password);
module.exports={sendSelfSignupWelcome,shouldSendTemporaryPassword};
