const assert=require('node:assert/strict');
const {approvalMessage,createApprovalEmail}=require('../backend/expense-email.cjs');
const claim={id:'claim-1',owner_id:'staff-1',version:3,status:'approved',amount_paise:'12345',reason:'<script>unsafe</script>',review_note:'OK & done',updated_at:'2026-10-23T10:00:00Z'};
async function main(){
 const message=approvalMessage(claim,'A < B');
 assert.match(message.html,/logo.png/);assert.match(message.html,/&lt;script&gt;/);assert.ok(!message.html.includes('<script>'));
 assert.match(message.text,/₹123.45/);assert.match(message.text,/does not mean payment/);
 assert.match(approvalMessage({...claim,claim_type:'money_request'},'Staff').subject,/money request/);
 let sent;
 const db={auth:{admin:{getUserById:async id=>{assert.equal(id,'staff-1');return {data:{user:{email:'staff@example.test'}}};}}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{full_name:'Staff'}})})})})};
 const send=createApprovalEmail({db,from:'info@affiliateinnovations.co.in',resend:{emails:{send:async(...args)=>{sent=args;return {data:{id:'mail-1'}};}}}});
 await send(claim);assert.deepEqual(sent[0].to,['staff@example.test']);assert.equal(sent[1].idempotencyKey,'expense-approved-claim-1-3');
 await assert.rejects(send({...claim,status:'submitted'}));
 await assert.rejects(createApprovalEmail({db,resend:null})(claim));
 let smtpConfig,smtpMessage,closed=false;
 const mailer={createTransport(config){smtpConfig=config;return {sendMail:async message=>{smtpMessage=message;return {accepted:['staff@example.test'],rejected:[],messageId:message.messageId}},close(){closed=true}}}};
 const env={EXPENSE_EMAIL_PROVIDER:'titan',TITAN_SMTP_USER:'info@affiliateinnovations.co.in',TITAN_SMTP_PASSWORD:'test-only'};
 await createApprovalEmail({db,env,mailer})(claim);
 assert.equal(smtpConfig.host,'smtpout.secureserver.net');assert.equal(smtpConfig.port,465);assert.equal(smtpConfig.secure,true);assert.equal(smtpConfig.requireTLS,true);
 assert.match(smtpMessage.from,/No Reply/);assert.deepEqual(smtpMessage.to,['staff@example.test']);assert.equal(closed,true);
 await assert.rejects(createApprovalEmail({db,env:{...env,TITAN_SMTP_PASSWORD:''},mailer})(claim));
 await assert.rejects(createApprovalEmail({db,env:{...env,TITAN_SMTP_PORT:'25'},mailer})(claim));
 await assert.rejects(createApprovalEmail({db,env:{...env,TITAN_SMTP_HOST:'untrusted.example'},mailer})(claim));
 console.log('Expense approval email tests passed');
}
main().catch(error=>{console.error(error);process.exitCode=1});
