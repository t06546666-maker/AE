const assert=require('node:assert/strict'),fs=require('node:fs');
const {sendSelfSignupWelcome,shouldSendTemporaryPassword}=require('../backend/customer-signup-whatsapp.cjs');
async function main(){
 const calls=[];const customer={id:'customer-1',name:'Safar',phone:'919000000000',temporary_password:'never-forward'};
 const deps={queue:async(...args)=>{calls.push(['queue',...args]);return {queued:true,logId:'log-1'}},sendTemplate:async args=>{calls.push(['send',args]);return {sent:true}},appLink:'https://play.google.com/store/apps/details?id=com.affiliateae.app'};
 assert.equal((await sendSelfSignupWelcome(customer,deps)).sent,true);
 assert.equal(calls[0][2],'registration');assert.equal(calls[0][3],'welcome');assert.equal(calls[0][1].temporary_password,undefined);
 assert.equal(calls[1][1].templateName,'welcome');assert.equal(calls[1][1].logId,'log-1');assert.equal(calls[1][1].components[0].parameters.length,2);assert.ok(!JSON.stringify(calls).includes('never-forward'));assert.equal(calls.filter(c=>c[0]==='send').length,1);
 assert.equal(shouldSendTemporaryPassword({temporary_password:'123456'}),false);assert.equal(shouldSendTemporaryPassword({temporary_password:'123456',send_temporary_password:true}),true);assert.equal(shouldSendTemporaryPassword({temporary_password:'123456',send_temporary_password:false}),false);
 let sent=false;assert.equal((await sendSelfSignupWelcome(customer,{...deps,queue:async()=>({queued:false}),sendTemplate:async()=>{sent=true}})).sent,false);assert.equal(sent,false);
 const server=fs.readFileSync('server.js','utf8');const signup=server.slice(server.indexOf("app.post('/api/auth/customer/signup'"),server.indexOf("app.post('/api/auth/customer/reset-password-otp'"));
 assert.ok(signup.indexOf('sendSelfSignupWelcome')>signup.indexOf('if (created.error) throw created.error'));assert.match(signup,/scheduleBackground/);assert.ok(!signup.includes('sendRegistrationWhatsApp'));
 assert.match(server,/purchase.send_temporary_password = createdCustomer && req.auth.profile.role === 'merchant'/);
 console.log('PASS: self-signup welcome only, verified recipient, queued log, no temporary credentials, merchant-only password gate, failed-queue behavior');
}
main().catch(e=>{console.error(e);process.exitCode=1});
