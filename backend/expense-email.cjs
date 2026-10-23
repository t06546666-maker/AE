const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function approvalMessage(claim,name){
 const kind=claim.claim_type==='money_request'?'money request':'expense claim';
 const paise=BigInt(claim.amount_paise);
 const amount=`₹${paise/100n}.${String(paise%100n).padStart(2,'0')}`;
 const approved=new Date(claim.updated_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
 const url=`https://www.affiliateae.co.in/expenses?claim=${encodeURIComponent(claim.id)}`;
 const details=[['Reference',claim.id],['Amount',amount],['Purpose',claim.reason],['Approved on',approved],...(claim.review_note?[['Accounts note',claim.review_note]]:[])];
 const disclaimer='Please do not reply to this automated email. Approval does not mean payment has been completed. Check your staff portal for payment updates.';
 return {subject:`Your ${kind} has been approved`,
  text:`Hi ${name},\n\nYour ${kind} has been approved by the Accounts team.\n\n${details.map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nView details: ${url}\n\n${disclaimer}\n\nAccounts Team\nAffiliate Innovations Private Limited`,
  html:`<!doctype html><html><body style="margin:0;background:#f3f6fc;font-family:Arial,sans-serif;color:#162b4d"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:560px;background:white;border-radius:16px"><tr><td style="padding:32px"><img src="https://www.affiliateae.co.in/logo.png" alt="AE" width="100" style="display:block;height:auto;margin-bottom:28px"><p style="color:#1464e8;font-size:12px;letter-spacing:2px;font-weight:bold">APPROVAL CONFIRMATION</p><h1 style="font-size:24px">Your ${kind} is approved</h1><p>Hi ${escape(name)},</p><p>Your ${kind} has been approved by the Accounts team.</p><table role="presentation" width="100%">${details.map(([k,v])=>`<tr><td style="padding:10px 0;border-bottom:1px solid #edf1f8;vertical-align:top;width:120px;color:#63728a">${escape(k)}</td><td style="padding:10px 0;border-bottom:1px solid #edf1f8;overflow-wrap:anywhere">${escape(v)}</td></tr>`).join('')}</table><p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#1464e8;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">View request</a></p><p style="font-size:13px;color:#63728a;line-height:1.6">${disclaimer}</p><p style="line-height:1.6">Accounts Team<br>Affiliate Innovations Private Limited</p></td></tr></table></td></tr></table></body></html>`};
}
function titanTransport(env=process.env,mailer){
 if(env.EXPENSE_EMAIL_PROVIDER!=='titan')return null;
 if(env.TITAN_SMTP_USER!=='info@affiliateinnovations.co.in'||!env.TITAN_SMTP_PASSWORD)throw Error('Titan credentials are not configured.');
 const port=Number(env.TITAN_SMTP_PORT||465);
 if(![465,587].includes(port))throw Error('Invalid Titan SMTP port.');
 const host=env.TITAN_SMTP_HOST||'smtpout.secureserver.net';
 if(!['smtp.titan.email','smtpout.secureserver.net'].includes(host))throw Error('Unsupported Titan SMTP host.');
 return (mailer||require('nodemailer')).createTransport({host,port,secure:port===465,requireTLS:true,auth:{user:env.TITAN_SMTP_USER,pass:env.TITAN_SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
}
function createApprovalEmail({db,resend,from=process.env.EXPENSE_FROM_EMAIL,env=process.env,mailer}){
 return async claim=>{
  const titan=env.EXPENSE_EMAIL_PROVIDER==='titan';
  if(!titan&&(!resend||from!=='info@affiliateinnovations.co.in'))throw Error('Expense email sender is not configured.');
  if(claim.status!=='approved')throw Error('Only approved claims can trigger approval email.');
  // Resolve identity server-side, never from the review request body.
  const account=await db.auth.admin.getUserById(claim.owner_id);
  if(account.error||!account.data?.user?.email)throw Error('Staff email unavailable.');
  const profile=await db.from('profiles').select('full_name').eq('id',claim.owner_id).single();
  if(profile.error)throw profile.error;
  const message=approvalMessage(claim,profile.data?.full_name||'colleague');
  const sender=`AE Accounts — No Reply <${titan?'info@affiliateinnovations.co.in':from}>`;
  if(titan){
   const transport=titanTransport(env,mailer);
   try{
    const sent=await transport.sendMail({from:sender,to:[account.data.user.email],...message,messageId:`<expense-approved-${claim.id}-${claim.version}@affiliateinnovations.co.in>`});
    if(!sent.accepted?.length||sent.rejected?.length)throw Error('Titan did not accept the recipient.');
    return {id:sent.messageId};
   }finally{transport.close();}
  }
  const result=await resend.emails.send({from:sender,to:[account.data.user.email],...message},{idempotencyKey:`expense-approved-${claim.id}-${claim.version}`});
  if(result.error)throw Error('Approval email provider rejected delivery.');
  return result.data;
 };
}
module.exports={approvalMessage,createApprovalEmail,titanTransport};
