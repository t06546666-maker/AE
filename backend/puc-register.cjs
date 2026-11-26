const crypto=require('node:crypto');
const eligibleCategory=name=>/\b(puc|pol{1,2}ution|emission)\b/i.test(String(name||''));
function registration(body){
 const name=String(body.name||'').trim(),phone=String(body.phone||'').trim(),plate=String(body.plate||'').toUpperCase().replace(/\s+/g,''),model=String(body.model||'').trim();
 const amount=Number(body.amount),rate=Number(body.rate),testDate=String(body.testDate||''),expiryDate=String(body.expiryDate||'');
 const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(name.length<2||name.length>100||!/^\+?\d{10,12}$/.test(phone)||!/^[A-Z0-9-]{6,20}$/.test(plate)||!model||model.length>100||!Number.isFinite(amount)||amount<1||amount>1000000||Math.abs(amount*100-Math.round(amount*100))>0.000001||!Number.isInteger(rate)||rate<1||rate>100||!date(testDate)||!date(expiryDate)||expiryDate<=testDate||body.consent!==true)throw Error('Enter customer, vehicle, fee, valid dates, reward rate and customer consent.');
 return {name,phone,plate,model,amount,rate,testDate,expiryDate,consent:true};
}
function registerPuc(app,{db,database,auth,merchantRole,rewards,onboard}){
 const access=async req=>{const result=await db.from('active_merchants').select('id,name,merchant_categories(name)').eq('id',req.auth.profile.merchant_id).maybeSingle();if(result.error)throw Error('Shop access is unavailable.');return result.data&&eligibleCategory(result.data.merchant_categories?.name)?result.data:null;};
 const collection=(store,id)=>store.collection('ae_puc_shops').doc(id).collection('registrations');
 app.get('/api/merchant/puc/config',auth,merchantRole,async(req,res)=>{try{const shop=await access(req);if(!shop)return res.json({eligible:false});const config=await rewards();res.json({eligible:true,shopName:shop.name,earnOptions:config.earnOptions.filter(n=>Number.isInteger(n)&&n>=1&&n<=100)});}catch{return res.status(503).json({error:'PUC settings are unavailable.'});}});
 app.get('/api/merchant/puc/records',auth,merchantRole,async(req,res)=>{try{const shop=await access(req);if(!shop)return res.status(403).json({error:'PUC category access required.'});let range;try{range=require('./puc-expiry-filter.cjs').expiryFilter(String(req.query.filter||'all'),String(req.query.month||''),new Date(),req.query.days?Number(req.query.days):null);}catch(e){return res.status(400).json({error:e.message});}if(range.empty)return res.json({records:[],nextCursor:null});const store=await database(),limit=100,pageAfter=String(req.query.after||'');let query=collection(store,shop.id);if(range.from)query=query.where('expiryDate','>=',range.from);if(range.to)query=query.where('expiryDate','<=',range.to);query=query.orderBy(range.sortByExpiry?'expiryDate':'createdAt',range.sortByExpiry?'asc':'desc').limit(limit+1);if(pageAfter){if(!/^[a-f0-9]{64}$/.test(pageAfter))return res.status(400).json({error:'Invalid page.'});const cursor=await collection(store,shop.id).doc(pageAfter).get();if(!cursor.exists)return res.status(400).json({error:'Page is unavailable.'});query=query.startAfter(cursor);}const rows=await query.get(),docs=rows.docs.slice(0,limit);res.json({records:docs.map(doc=>({id:doc.id,...doc.data()})),nextCursor:rows.docs.length>limit?docs.at(-1).id:null});}catch{return res.status(503).json({error:'PUC records are unavailable. Please retry.'});}});
 app.post('/api/merchant/puc/records',auth,merchantRole,async(req,res)=>{
  let ref;
  try{
   const shop=await access(req);if(!shop)return res.status(403).json({error:'PUC category access required.'});
   let value;try{value=registration(req.body);}catch(e){return res.status(400).json({error:e.message});}
   const config=await rewards();if(!config.earnOptions.includes(value.rate))return res.status(400).json({error:'Choose a current official reward rate.'});
   const key=req.get('Idempotency-Key');if(!/^[a-zA-Z0-9-]{16,80}$/.test(key||''))return res.status(400).json({error:'Reopen the registration form before saving.'});
   const store=await database(),id=crypto.createHash('sha256').update(shop.id+':'+key).digest('hex'),fingerprint=crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');ref=collection(store,shop.id).doc(id);
   const previous=await store.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists)return doc.data();tx.set(ref,{...value,fingerprint,status:'processing',createdAt:Date.now()});return null;});
   if(previous){if(previous.fingerprint!==fingerprint)return res.status(409).json({error:'This submission changed. Open a new form.'});if(previous.status==='completed')return res.json({success:true,record:{id,...previous}});return res.status(409).json({error:'This registration needs review. Check transaction history before retrying.'});}
   const result=await onboard(req,value,'puc-'+id);
   if(result.status>=400||!result.body?.success){await ref.update({status:'needs_review'});return res.status(409).json({error:result.body?.error||'Registration needs merchant review. Check transaction history before retrying.'});}
   const record={...value,status:'completed',createdAt:Date.now(),customerCode:result.body.customer.id,orderId:result.body.order.order_id,orderNo:result.body.order.order_no,points:Number(result.body.order.points_earned||0)};
   await ref.update(record);return res.status(201).json({success:true,record:{id,...record}});
  }catch{if(ref)try{await ref.update({status:'needs_review'});}catch{}return res.status(503).json({error:'Could not confirm registration. Check transaction history before retrying.'});}
 });
}
module.exports={registerPuc,eligibleCategory,registration};
