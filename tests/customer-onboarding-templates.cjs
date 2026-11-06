const assert=require('node:assert/strict'),fs=require('node:fs');
const templates=require('../backend/customer-onboarding-templates.cjs');
const {sendSelfSignupWelcome}=require('../backend/customer-signup-whatsapp.cjs');
assert.equal(templates.welcomeTemplate('welcome'),'ae_welcome_bonus_ml_1');
assert.equal(templates.temporaryTemplate('temporary'),'temporary_2');
assert.equal(templates.welcomeTemplate('custom'),'custom');
assert.deepEqual(templates.welcomeComponents(templates.WELCOME_TEMPLATE,'Customer','https://app','https://instagram')[0].parameters.map(p=>p.text),['Customer','https://app','https://instagram']);
assert.deepEqual(templates.temporaryComponents('temporary_2',{customer_phone:'919876123456',temporary_password:'123456'}),[]);
assert.throws(()=>templates.temporaryComponents('temporary_2',{customer_phone:'919876123456',temporary_password:'OtherPassword'}));
const source=fs.readFileSync('server.js','utf8');
const registration=source.slice(source.indexOf('async function sendRegistrationWhatsApp('),source.indexOf('async function sendRewardWhatsApp('));
const purchase={customer_id:'c1',customer_code:'C1',customer_name:'Customer',customer_phone:'919876123456',temporary_password:'123456',send_temporary_password:true};
async function merchantTest(record,failWelcome=false){
 const calls=[];
 const send=async args=>{calls.push(args);return {sent:!(failWelcome&&args.templateName===templates.WELCOME_TEMPLATE)};};
 const stub={from:()=>({update:()=>({eq:async()=>({})})})};
 const names=['WA_TOKEN','WA_PHONE_ID','WA_REGISTRATION_TEMPLATE','WA_TEMPORARY_TEMPLATE','WA_CUSTOMER_APP_LINK','WA_CUSTOMER_INSTAGRAM_LINK','WA_CUSTOMER_USAGE_TEMPLATE','customerOnboardingTemplates','sendWhatsAppTemplate','supabaseAdmin','uploadQrMedia','formatPoints','require'];
 const fn=new Function(...names,registration+';return sendRegistrationWhatsApp;')('test','test',templates.WELCOME_TEMPLATE,templates.TEMPORARY_TEMPLATE,'https://app',templates.INSTAGRAM_LINK,templates.USAGE_TEMPLATE,templates,send,stub,()=>{throw Error('No QR header expected')},String,name=>name==='./backend/customer-signup-whatsapp.cjs'?require('../backend/customer-signup-whatsapp.cjs'):require(name));
 await fn(record,'log-1');return calls;
}
(async()=>{
 const calls=await merchantTest(purchase);assert.deepEqual(calls.map(c=>c.templateName),['ae_welcome_bonus_ml_1','temporary_2','ae_use']);assert.equal(calls[0].components.length,1);assert.deepEqual(calls[1].components,[]);assert.ok(calls.every(c=>c.languageCode==='en'));assert.ok(!JSON.stringify(calls.map(c=>c.components)).includes('123456'));
 assert.deepEqual((await merchantTest(purchase,true)).map(c=>c.templateName),['ae_welcome_bonus_ml_1','temporary_2','ae_use']);
 assert.deepEqual((await merchantTest({...purchase,send_temporary_password:false})).map(c=>c.templateName),['ae_welcome_bonus_ml_1','ae_use']);
 assert.deepEqual((await merchantTest({...purchase,skip_welcome_message:true})).map(c=>c.templateName),['temporary_2']);
 assert.ok(!(await merchantTest({...purchase,temporary_password:'RandomPassword'})).some(c=>c.templateName==='temporary_2'));
 let count=0;const welcome=await sendSelfSignupWelcome({id:'c1',name:'Customer',phone:'919876123456'},{queue:async()=>({queued:true}),sendTemplate:async()=>{count++;if(count===1)throw Error('Marketing failure');return {sent:true}},appLink:'https://app'});assert.equal(count,2);assert.equal(welcome.usage.sent,true);
 assert.ok(source.includes('if (!welcomeBonus.error) scheduleBackground'));
 console.log('PASS: approved Malayalam payload fields/language, no QR header, static credentials, merchant-only password, failure isolation, usage follow-up and bonus guard.');
})().catch(error=>{console.error(error);process.exitCode=1});
