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
 console.log('Expense approval email tests passed');
}
main().catch(error=>{console.error(error);process.exitCode=1});
