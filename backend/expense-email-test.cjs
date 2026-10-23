const {titanTransport}=require('./expense-email.cjs');
const recipient='safar@affiliateinnovations.co.in';
async function testTitan({env=process.env,mailer}={}){
 const failures=[];
 for(const port of (env.TITAN_SMTP_HOST==='smtp.titan.email'?[465,587]:[465])){
  let transport;
  try{
   transport=titanTransport({...env,TITAN_SMTP_PORT:String(port)},mailer);
   if(!transport)throw Object.assign(Error('Titan not configured'),{code:'NOT_CONFIGURED'});
   // Retry only connection verification. Never retry an ambiguous send.
   await transport.verify();
  }catch(error){transport?.close();failures.push({port,code:['ETIMEDOUT','ECONNECTION','ECONNREFUSED','EAUTH','ESOCKET','EDNS'].includes(error.code)?error.code:'NOT_CONFIGURED',responseCode:error.responseCode||null});continue;}
  try{
   const sent=await transport.sendMail({from:'AE Accounts — No Reply <info@affiliateinnovations.co.in>',to:[recipient],subject:'AE email delivery test — no claim approved',text:'Hi Safar, this is an AE email delivery test through Titan. No claim was approved and no payment was made. Please do not reply to this automated email.',html:'<div style="font-family:Arial;color:#162b4d;max-width:560px;margin:auto;padding:32px"><img src="https://www.affiliateae.co.in/logo.png" alt="AE" width="100"><h1>Email delivery test</h1><p>Hi Safar,</p><p>This is an AE email delivery test through Titan.</p><p><strong>No claim was approved and no payment was made.</strong></p><p>Please do not reply to this automated email.</p><p>Accounts Team<br>Affiliate Innovations Private Limited</p></div>'});
   return {sent:!!sent.accepted?.length&&!sent.rejected?.length,recipient,port,messageId:sent.messageId||null,failures};
  }catch(error){return {sent:false,recipient,port,failures,sendError:['ETIMEDOUT','EAUTH','EENVELOPE','EMESSAGE','ECONNECTION','ESOCKET'].includes(error.code)?error.code:'SEND_FAILED',deliveryUnknown:true};}
  finally{transport.close();}
 }
 return {sent:false,recipient,failures};
}
function registerEmailTest(app,{requireAuth,requireRole,env=process.env,mailer}){
 const attempts=new Map();
 app.post('/api/admin/expense-email-test',requireAuth,requireRole('admin'),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.body?.confirm!==recipient)return res.status(400).json({error:'Confirm the fixed test recipient.'});
  const now=Date.now();for(const [id,until]of attempts)if(until<=now)attempts.delete(id);
  const id=req.auth.profile.id;
  if(attempts.has(id))return res.status(429).json({error:'Wait five minutes before another email test.'});
  attempts.set(id,now+300000);
  try{res.json(await testTitan({env,mailer}));}
  catch{res.status(503).json({error:'Email test unavailable.'});}
 });
}
module.exports={registerEmailTest,testTitan};
