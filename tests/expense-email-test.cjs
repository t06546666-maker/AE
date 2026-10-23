const assert=require('node:assert/strict');
const {testTitan,registerEmailTest}=require('../backend/expense-email-test.cjs');
async function main(){
 const env={EXPENSE_EMAIL_PROVIDER:'titan',TITAN_SMTP_USER:'info@affiliateinnovations.co.in',TITAN_SMTP_PASSWORD:'test-only'};
 let sends=0,closed=0;
 const mailer={createTransport:({port})=>({verify:async()=>{if(port===465)throw Object.assign(Error(),{code:'ETIMEDOUT'})},sendMail:async mail=>{sends++;assert.deepEqual(mail.to,['safar@affiliateinnovations.co.in']);return {accepted:mail.to,rejected:[],messageId:'test'}},close(){closed++}})};
 const result=await testTitan({env,mailer});assert.equal(result.sent,true);assert.equal(result.port,587);assert.equal(sends,1);assert.equal(closed,2);
 let route;const auth=()=>{},role=()=>{};
 registerEmailTest({post:(...args)=>{route=args}},{requireAuth:auth,requireRole:r=>{assert.equal(r,'admin');return role},env,mailer});
 assert.equal(route[1],auth);assert.equal(route[2],role);
 const req={auth:{profile:{id:'admin'}},body:{confirm:'wrong@example.test'}};
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(value){this.value=value;return this}};
 await route[3](req,res);assert.equal(res.statusCode,400);assert.equal(sends,1);
 req.body.confirm='safar@affiliateinnovations.co.in';await route[3](req,res);assert.equal(sends,2);await route[3](req,res);assert.equal(res.statusCode,429);assert.equal(sends,2);
 console.log('PASS: fixed recipient, auth/role middleware, connect fallback, single send and cooldown');
}
main().catch(e=>{console.error(e);process.exitCode=1});
