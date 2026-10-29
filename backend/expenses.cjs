const multer=require('multer');
const crypto=require('node:crypto');
const {validNewPassword,PASSWORD_HELP}=require('./password-policy.cjs');
const {summarize,filters:reportFilters}=require('./expense-reports.cjs');
const departments=['Accounts','Developer','Field Manager','HR','Marketing','Other'];
const categories=['Petrol/Fuel','Travel','IT Support','Marketing','Office Supplies','Other'];
const statuses=['draft','submitted','corrections','approved','rejected','paid','cancelled'];
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const today=()=>new Date(Date.now()+330*60000).toISOString().slice(0,10);
function date(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function money(value){if(typeof value!=='string'||!/^\d{1,9}(\.\d{1,2})?$/.test(value))throw Error('Enter a valid INR amount with up to two decimals.');const [whole,fraction='']=value.split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(amount<1||amount>100000000000)throw Error('Invalid amount.');return amount;}
function text(value,max=2000){return typeof value==='string'?value.trim().slice(0,max):'';}
function claimInput(body){const kind=body.claim_type||'expense';if(!['expense','money_request'].includes(kind))throw Error('Choose expense claim or money request.');if(kind==='money_request'&&(!date(body.needed_by)||body.needed_by<(body.requested_on||today())))throw Error('Choose a valid money needed by date.');const expenseDate=kind==='money_request'?(body.requested_on||today()):body.expense_date;if(!categories.includes(body.category)||!date(expenseDate)||expenseDate>today()||!text(body.reason))throw Error('Category, valid expense date and reason are required.');return {category:body.category,expense_date:expenseDate,amount_paise:money(body.amount),reason:text(body.reason),missing_receipt_reason:text(body.missing_receipt_reason),...(kind==='money_request'?{claim_type:kind,requested_on:expenseDate,needed_by:body.needed_by}:{claim_type:kind,requested_on:null,needed_by:null})};}
function receiptType(buffer){if(buffer.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(buffer.subarray(0,5).toString()==='%PDF-')return 'application/pdf';return null;}
function registerExpenses(app,{db,auth,requireAuth,requireRole,notifyProfile,notifyRole,sendApprovalEmail}){
 const attempts=new Map();
 function loginLimit(req,res,next){const now=Date.now();for(const [key,value]of attempts)if(value.until<now)attempts.delete(key);const key=crypto.createHash('sha256').update(String(req.ip)+'|'+text(req.body.email,254).toLowerCase()).digest('hex');const value=attempts.get(key)||{count:0,until:now+15*60000};if(value.count>=10||attempts.size>10000)return res.status(429).json({error:'Too many sign-in attempts. Try again later.'});value.count++;attempts.set(key,value);next();}
 const wrap=fn=>async(req,res)=>{try{await fn(req,res)}catch(error){console.warn('Expense request failed:',error.code||error.message);res.status(error.status||503).json({error:error.status?error.message:'Expenses unavailable. Check the expense migration and retry.'})}};
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 async function member(profile){
  if(profile.role==='field_manager'){
   const added=await db.from('expense_members').upsert({profile_id:profile.id,department:'Field Manager'},{onConflict:'profile_id',ignoreDuplicates:true});if(added.error)throw added.error;
  }
  const result=await db.from('expense_members').select('*').eq('profile_id',profile.id).maybeSingle();if(result.error)throw result.error;return result.data;
 }
 const guard=kind=>[requireAuth,wrap(async(req,res)=>{
  const profile=req.auth.profile;const allowed=kind==='accounts'?profile.role==='account_head':['staff','field_manager'].includes(profile.role);
  if(!allowed)fail(kind==='accounts'?'Account Head access required.':'Employee access required.',403);
  const membership=await member(profile);if(!membership?.active)fail('Expense account is not active.',403);req.expenseMember=membership;res.locals.expenseAllowed=true;
 })];
 // Middleware wrappers must explicitly call next only on successful access checks.
 function access(kind){const [authMiddleware,check]=guard(kind);return [authMiddleware,(req,res,next)=>check(req,res).then(()=>{if(res.locals.expenseAllowed&&!res.headersSent)next()})]}
 const employee=access('expenses'),head=access('accounts');
 function result(response){if(response.error)throw response.error;return response.data;}
 async function owned(req,id,isHead){if(!uuid(id))fail('Invalid claim ID.');let query=db.from('expense_claims').select('*').eq('id',id);if(!isHead)query=query.eq('owner_id',req.auth.profile.id);const row=result(await query.maybeSingle());if(!row)fail('Claim not found.',404);return row;}
 async function event(row,action){try{const message={type:'expense',requestId:row.id,url:action==='submit'?`/accounts?claim=${row.id}`:`/expenses?claim=${row.id}`};if(action==='submit'){const heads=result(await db.from('expense_members').select('profile_id,profiles!expense_members_profile_id_fkey(role)').eq('active',true));for(const target of heads.filter(head=>head.profiles?.role==='account_head'))await notifyProfile(target.profile_id,'Expense submitted','A staff expense is ready for review.',message);}else if(['approve','reject','corrections','pay'].includes(action))await notifyProfile(row.owner_id,'Expense update',`Your expense status is ${row.status}.`,message);}catch{console.warn('Expense notification unavailable; claim remains saved.')}}
 async function act(req,id,action,payload){
  if(!uuid(req.body.request_id)||!uuid(id))fail('Valid request and claim IDs are required.');
  // Do not silently save a money request as an old-style expense before migration.
  if(payload.claim_type==='money_request')result(await db.from('expense_claims').select('claim_type,requested_on,needed_by').range(0,0));
  const version=action==='create'?null:Number(req.body.version);if(action!=='create'&&(!Number.isInteger(version)||version<1))fail('Claim version required.');
  const response=await db.rpc('expense_action',{p_actor:req.auth.profile.id,p_claim:id,p_action:action,p_payload:payload,p_request:req.body.request_id,p_version:version});
  if(response.error){const message=response.error.message||'';if(response.error.code==='P0001')fail(message,/changed|status|already/.test(message)?409:400);throw response.error;}
  if(!response.data.replayed){
   await event(response.data.claim,action);
   if(action==='approve'&&sendApprovalEmail){
    try{await sendApprovalEmail(response.data.claim);response.data.approval_email='sent';}
    catch{console.warn('Expense approval saved, but approval email was not sent.');response.data.approval_email='failed';}
   }
  }
  return response.data;
 }
 app.post('/api/expenses/login',loginLimit,wrap(async(req,res)=>{
  if(!auth||!db)fail('Expenses unavailable.',503);
  const email=text(req.body.email,254).toLowerCase(),password=typeof req.body.password==='string'?req.body.password:'';
  if(!email.includes('@')||!password)fail('Email and password are required.');
  const signed=await auth.auth.signInWithPassword({email,password});if(signed.error)fail('Invalid email or password.',401);
  const profile=result(await db.from('profiles').select('*').eq('id',signed.data.user.id).single());
  const accounts=req.body.portal==='accounts';
  if(accounts?profile.role!=='account_head':!['staff','field_manager'].includes(profile.role))fail('This account cannot access the selected portal.',403);
  const membership=await member(profile);if(!membership?.active||(!accounts&&membership.department!==req.body.department))fail('Use your assigned department and active staff account.',403);
  res.json({user:{id:profile.id,full_name:profile.full_name,role:profile.role,merchant_id:null,email:signed.data.user.email,must_change_password:profile.must_change_password},accessToken:signed.data.session.access_token,refreshToken:signed.data.session.refresh_token});
 }));
 for(const [prefix,middleware,isHead] of [['/api/expenses',employee,false],['/api/accounts',head,true]]){
  app.get(prefix+'/me',...middleware,wrap(async(req,res)=>res.json({department:req.expenseMember.department})));
  app.get(prefix+'/claims',...middleware,wrap(async(req,res)=>{
   const page=Math.max(1,Math.min(100000,parseInt(req.query.page)||1));
   let query=db.from('expense_claims').select('*,profiles!expense_claims_owner_id_fkey(full_name)',{count:'exact'});
   if(!isHead)query=query.eq('owner_id',req.auth.profile.id);
   if(isHead)query=reportFilters(query,req.query,fail);
   else {if(req.query.status){if(!statuses.includes(req.query.status))fail('Invalid status.');query=query.eq('status',req.query.status);}for(const [key,op]of [['from','gte'],['to','lte']])if(req.query[key]){if(!date(req.query[key]))fail('Invalid date filter.');query=query[op]('expense_date',req.query[key]);}}
   const response=await query.order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1);result(response);
   // Totals are for all accessible claims, not just the current list page.
   let totals=db.from('expense_claims').select('status,amount_paise');if(!isHead)totals=totals.eq('owner_id',req.auth.profile.id);
  const summary={};for(let offset=0;;offset+=500){const rows=result(await totals.order('id').range(offset,offset+499));for(const row of rows){summary[row.status]??={count:0,amount_paise:0n};summary[row.status].count++;summary[row.status].amount_paise+=BigInt(row.amount_paise);}if(rows.length<500)break;}
   for(const value of Object.values(summary))value.amount_paise=value.amount_paise.toString();
   res.setHeader('Cache-Control','no-store');res.json({claims:response.data,total:response.count,page,summary});
  }));
  app.get(prefix+'/claims/:id',...middleware,wrap(async(req,res)=>{const claim=await owned(req,req.params.id,isHead);const receipts=result(await db.from('expense_receipts').select('id,name,mime,created_at').eq('claim_id',claim.id));const audit=result(await db.from('expense_audit').select('id,action,created_at,snapshot,actor_id,profiles!expense_audit_actor_id_fkey(full_name)').eq('claim_id',claim.id).order('created_at'));res.setHeader('Cache-Control','no-store');res.json({claim,receipts,audit});}));
  app.get(prefix+'/claims/:id/receipts/:receipt',...middleware,wrap(async(req,res)=>{
   await owned(req,req.params.id,isHead);if(!uuid(req.params.receipt))fail('Invalid receipt.');
   const row=result(await db.from('expense_receipts').select('path').eq('id',req.params.receipt).eq('claim_id',req.params.id).maybeSingle());if(!row)fail('Receipt not found.',404);
   const signed=result(await db.storage.from('expense-receipts').createSignedUrl(row.path,60,{download:true}));res.setHeader('Cache-Control','no-store');res.json({url:signed.signedUrl});
  }));
 }
 app.post('/api/expenses/claims',...employee,wrap(async(req,res)=>{let input;try{input=claimInput(req.body)}catch(e){fail(e.message)}res.json(await act(req,req.body.id,'create',input));}));
 app.put('/api/expenses/claims/:id',...employee,wrap(async(req,res)=>{let input;try{input=claimInput(req.body)}catch(e){fail(e.message)}res.json(await act(req,req.params.id,'save',input));}));
 app.post('/api/expenses/claims/:id/submit',...employee,wrap(async(req,res)=>res.json(await act(req,req.params.id,'submit',{}))));
 // Cancellation is deliberately silent: no email or push event is emitted.
 app.post('/api/expenses/claims/:id/cancel',...employee,wrap(async(req,res)=>{
  if(!uuid(req.params.id)||!uuid(req.body.request_id)||!Number.isInteger(req.body.version)||req.body.version<1)fail('Valid claim, request and version are required.');
  const response=await db.rpc('expense_cancel',{p_actor:req.auth.profile.id,p_claim:req.params.id,p_request:req.body.request_id,p_version:req.body.version});
  if(response.error){if(response.error.code==='P0001')fail(response.error.message,409);throw response.error;}
  res.json(response.data);
 }));
 const upload=multer({storage:multer.memoryStorage(),limits:{files:1,fileSize:5*1024*1024}}).single('receipt');
 app.post('/api/expenses/claims/:id/receipts',...employee,(req,res,next)=>upload(req,res,error=>error?res.status(400).json({error:'Upload one JPG, PNG or PDF, up to 5 MB.'}):next()),wrap(async(req,res)=>{
  const claim=await owned(req,req.params.id,false);if(!['draft','corrections'].includes(claim.status))fail('This claim cannot be edited.',409);
  const mime=req.file&&receiptType(req.file.buffer);if(!mime||mime!==req.file.mimetype)fail('Upload a valid JPG, PNG or PDF receipt.');
  if(!uuid(req.body.request_id))fail('Request ID required.');
  const id=req.body.request_id,path=`${req.auth.profile.id}/${claim.id}/${id}`;
  const stored=await db.storage.from('expense-receipts').upload(path,req.file.buffer,{contentType:mime,upsert:false});
  if(stored.error)fail('Receipt upload failed. Refresh the claim before retrying.',409);
  try{res.json(await act(req,claim.id,'attach',{id,path,name:text(req.file.originalname,160),mime}));}
  catch(error){await db.storage.from('expense-receipts').remove([path]);throw error;}
 }));
 app.get('/api/accounts/employees',...head,wrap(async(req,res)=>{const rows=result(await db.from('expense_members').select('profile_id,department,profiles!expense_members_profile_id_fkey(full_name,role)').order('profile_id'));res.json({employees:rows.filter(row=>['staff','field_manager'].includes(row.profiles?.role))});}));
 async function reportRows(input,summary=false){
  const rows=[];for(let offset=0;;offset+=500){const query=reportFilters(db.from('expense_claims').select('*,profiles!expense_claims_owner_id_fkey(full_name)'),input,fail,{summary});const batch=result(await query.order('created_at',{ascending:false}).order('id').range(offset,offset+499));rows.push(...batch);if(rows.length>5000)fail('Too many records. Narrow the date or department filters.',400);if(batch.length<500)return rows;}
 }
 app.get('/api/accounts/summary',...head,wrap(async(req,res)=>{const rows=await reportRows(req.query,true);res.setHeader('Cache-Control','no-store');res.json({month:req.query.month,totals:summarize(rows)});}));
 app.get('/api/accounts/report',...head,wrap(async(req,res)=>{
  if(req.query.format&&!['json','xlsx'].includes(req.query.format))fail('Invalid report format.');
  const rows=await reportRows(req.query);res.setHeader('Cache-Control','no-store');
  if(req.query.format!=='xlsx')return res.json({claims:rows,total:rows.length});
  const ExcelJS=require('exceljs');const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Expense records');
  sheet.addRow(['Claim ID','Employee','Department','Expense','Expense date','Expense details','Amount INR','Status','Payment method','Payment date','Reference','Cash note','Request type','Request date','Money needed by']);
  for(const row of rows)sheet.addRow([row.id,row.profiles?.full_name||'',row.department,row.category,row.expense_date,row.reason,(BigInt(row.amount_paise)/100n).toString()+'.'+(BigInt(row.amount_paise)%100n).toString().padStart(2,'0'),row.status,row.payment_method||'',row.payment_date||'',row.payment_reference||'',row.payment_note||'',row.claim_type||'expense',row.requested_on||'',row.needed_by||'']);
  sheet.getRow(1).font={bold:true};sheet.columns.forEach(column=>column.width=24);
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="AE-expenses.xlsx"');res.send(Buffer.from(await book.xlsx.writeBuffer()));
 }));
 app.post('/api/accounts/claims/:id/review',...head,wrap(async(req,res)=>{if(!['approve','reject','corrections'].includes(req.body.action))fail('Invalid review action.');res.json(await act(req,req.params.id,req.body.action,{note:text(req.body.note)}));}));
 app.post('/api/accounts/claims/:id/payment',...head,wrap(async(req,res)=>{if(!date(req.body.payment_date)||req.body.payment_date>today()||!['Cash','UPI','Bank Transfer'].includes(req.body.payment_method))fail('Valid payment method and date required.');res.json(await act(req,req.params.id,'pay',{payment_date:req.body.payment_date,payment_method:req.body.payment_method,payment_reference:text(req.body.payment_reference,200),payment_note:text(req.body.payment_note)}));}));
 const admin=[requireAuth,requireRole('admin')];
 app.get('/api/admin/expense-staff',...admin,wrap(async(_req,res)=>{const rows=result(await db.from('expense_members').select('profile_id,department,active,profiles!expense_members_profile_id_fkey(full_name,role)').order('profile_id'));res.json({employees:rows});}));
 app.get('/api/admin/expense-staff/:id',...admin,wrap(async(req,res)=>{
  if(!uuid(req.params.id))fail('Invalid employee.');
  const profile=result(await db.from('profiles').select('id,role').eq('id',req.params.id).maybeSingle());
  if(!profile||!['staff','field_manager','account_head'].includes(profile.role))fail('Employee not found.',404);
  const response=await db.auth.admin.getUserById(profile.id);if(response.error)throw response.error;
  res.setHeader('Cache-Control','no-store');res.json({email:response.data.user?.email||''});
 }));
 app.post('/api/admin/expense-staff',...admin,wrap(async(req,res)=>{
  const {role,department}=req.body;const email=text(req.body.email,254).toLowerCase(),name=text(req.body.full_name,120),password=req.body.password;
  if(!['staff','account_head'].includes(role)||!departments.includes(department)||!name||!email.includes('@')||!validNewPassword(password))fail('Enter a name, email and department. '+PASSWORD_HELP);
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});if(created.error)fail('Could not create employee account.',400);
  try{result(await db.from('profiles').insert({id:created.data.user.id,full_name:name,role,merchant_id:null,must_change_password:true}));result(await db.from('expense_members').insert({profile_id:created.data.user.id,department}));}
  catch(error){await db.from('expense_members').delete().eq('profile_id',created.data.user.id);await db.from('profiles').delete().eq('id',created.data.user.id);await db.auth.admin.deleteUser(created.data.user.id);throw error;}
  res.json({id:created.data.user.id});
 }));
 app.put('/api/admin/expense-staff/:id',...admin,wrap(async(req,res)=>{
  if(!uuid(req.params.id)||!departments.includes(req.body.department)||typeof req.body.active!=='boolean')fail('Valid employee, department and active setting required.');
  const profile=result(await db.from('profiles').select('id,role').eq('id',req.params.id).maybeSingle());if(!profile||!['staff','field_manager','account_head'].includes(profile.role))fail('Employee not found.',404);
  if(profile.role==='field_manager'&&req.body.department!=='Field Manager')fail('Field Managers keep their assigned department.');
  result(await db.from('expense_members').upsert({profile_id:profile.id,department:req.body.department,active:req.body.active}));res.json({success:true});
 }));
 app.post('/api/admin/expense-staff/:id/password',...admin,wrap(async(req,res)=>{
  const password=req.body.password;
  if(!uuid(req.params.id)||!validNewPassword(password))fail(PASSWORD_HELP);
  const profile=result(await db.from('profiles').select('role').eq('id',req.params.id).maybeSingle());
  if(!profile||!['staff','field_manager','account_head'].includes(profile.role))fail('Employee not found.',404);
  // Set the password gate first: a failed auth update must not leave an ungated temporary credential.
  result(await db.from('profiles').update({must_change_password:true}).eq('id',req.params.id));
  const changed=await db.auth.admin.updateUserById(req.params.id,{password});if(changed.error)fail('Password reset failed. Retry or contact support.',503);
  res.json({success:true});
 }));
}
module.exports={registerExpenses,money,claimInput,receiptType,departments,categories,statuses};
