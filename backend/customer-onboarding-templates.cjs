// Approved Malayalam-body templates are registered in Meta with language code en.
const WELCOME_TEMPLATE = 'ae_welcome_bonus_ml_1';
const USAGE_TEMPLATE = 'ae_use';
const TEMPORARY_TEMPLATE = 'temporary_2';
const INSTAGRAM_LINK = 'https://www.instagram.com/ae.kerala/';
const welcomeTemplate = value => !value || value === 'welcome' ? WELCOME_TEMPLATE : value;
const temporaryTemplate = value => !value || value === 'temporary' ? TEMPORARY_TEMPLATE : value;
const isMalayalamWelcome = name => [WELCOME_TEMPLATE, 'ae_welcome_bonus_ml'].includes(name);
const body = values => [{ type:'body', parameters:values.map(value=>({type:'text',text:String(value)})) }];
function welcomeComponents(name, customerName, appLink, instagramLink=INSTAGRAM_LINK) {
 if(isMalayalamWelcome(name))return body([customerName,appLink,instagramLink]);
 if(name==='welcome')return body([customerName,appLink]);
 throw new Error('Unsupported simple welcome template');
}
function temporaryComponents(name, purchase) {
 if(['temporary','temporary_2'].includes(name)) {
  const phone=String(purchase.customer_phone||'').replace(/\D/g,'');
  if(phone.length<10 || String(purchase.temporary_password)!==phone.slice(-6))throw new Error('The static password template does not match the generated password.');
  return [];
 }
 return body([purchase.customer_name,purchase.temporary_password,purchase.customer_code]);
}
async function sendCustomerUsage(purchase,{sendTemplate,appLink,instagramLink=INSTAGRAM_LINK,usageTemplate=USAGE_TEMPLATE}) {
 if(!usageTemplate)return {sent:false,skipped:true};
 try{return await sendTemplate({customerId:purchase.customer_id,orderId:purchase.order_id,recipient:purchase.customer_phone,templateName:usageTemplate,messageType:'registration',languageCode:'en',components:body([appLink,instagramLink])});}
 catch{return {sent:false,error:'Customer usage message could not be sent.'};}
}
module.exports={WELCOME_TEMPLATE,USAGE_TEMPLATE,TEMPORARY_TEMPLATE,INSTAGRAM_LINK,welcomeTemplate,temporaryTemplate,isMalayalamWelcome,welcomeComponents,temporaryComponents,sendCustomerUsage};
