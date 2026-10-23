const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function approvalMessage(claim,name){
 const kind=claim.claim_type==='money_request'?'money request':'expense claim';
 const paise=BigInt(claim.amount_paise);
 const amount=`₹${paise/100n}.${String(paise%100n).padStart(2,'0')}`;
 const approved=new Date(claim.updated_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
 const url=`https://www.affiliateae.co.in/expenses?claim=${encodeURIComponent(claim.id)}`;
 const details=[['Reference',claim.id],['Amount',amount],['Purpose',claim.reason],['Approved on',approved],...(claim.review_note?[['Accounts note',claim.review_note]]:[])];
 const disclaimer='Approval does not mean payment has been completed. Check your staff portal for payment updates.';
 return {subject:`Your ${kind} has been approved`,
  text:`Hi ${name},\n\nYour ${kind} has been approved by the Accounts team.\n\n${details.map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nView details: ${url}\n\n${disclaimer}\n\nAccounts Team\nAffiliate Innovations Private Limited`,
  html:`<!doctype html><html><body style="margin:0;background:#f3f6fc;font-family:Arial,sans-serif;color:#162b4d"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:560px;background:white;border-radius:16px"><tr><td style="padding:32px"><img src="https://www.affiliateae.co.in/logo.png" alt="AE" width="100" style="display:block;height:auto;margin-bottom:28px"><p style="color:#1464e8;font-size:12px;letter-spacing:2px;font-weight:bold">APPROVAL CONFIRMATION</p><h1 style="font-size:24px">Your ${kind} is approved</h1><p>Hi ${escape(name)},</p><p>Your ${kind} has been approved by the Accounts team.</p><table role="presentation" width="100%">${details.map(([k,v])=>`<tr><td style="padding:10px 0;border-bottom:1px solid #edf1f8;vertical-align:top;width:120px;color:#63728a">${escape(k)}</td><td style="padding:10px 0;border-bottom:1px solid #edf1f8;overflow-wrap:anywhere">${escape(v)}</td></tr>`).join('')}</table><p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#1464e8;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">View request</a></p><p style="font-size:13px;color:#63728a;line-height:1.6">${disclaimer}</p><p style="line-height:1.6">Accounts Team<br>Affiliate Innovations Private Limited</p></td></tr></table></td></tr></table></body></html>`};
}
function createApprovalEmail({db,resend,from=process.env.EXPENSE_FROM_EMAIL}){
 return async claim=>{
  if(!resend||from!=='info@affiliateinnovations.co.in')throw Error('Expense email sender is not configured.');
  if(claim.status!=='approved')throw Error('Only approved claims can trigger approval email.');
  // Resolve identity server-side, never from the review request body.
  const account=await db.auth.admin.getUserById(claim.owner_id);
  if(account.error||!account.data?.user?.email)throw Error('Staff email unavailable.');
  const profile=await db.from('profiles').select('full_name').eq('id',claim.owner_id).single();
  if(profile.error)throw profile.error;
  const message=approvalMessage(claim,profile.data?.full_name||'colleague');
  const result=await resend.emails.send({from:`AE Accounts <${from}>`,to:[account.data.user.email],...message},{idempotencyKey:`expense-approved-${claim.id}-${claim.version}`});
  if(result.error)throw Error('Approval email provider rejected delivery.');
  return result.data;
 };
}
module.exports={approvalMessage,createApprovalEmail};
