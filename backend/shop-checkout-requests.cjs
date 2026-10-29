const crypto = require('node:crypto');
const TTL = 10 * 60 * 1000;
function validateAction(action) { return ['earn','combined'].includes(action); }
function assertPending(row, merchantId, now = Date.now()) {
  if (!row || row.merchantId !== merchantId) throw new Error('Request not found');
  if (row.status !== 'pending' || row.expiresAt <= now) throw new Error('Request already handled or expired');
}
async function shopQrPayload(database, merchantId) {
  const db=await database(), ref=db.collection('ae_shop_qr').doc(merchantId);
  const token=await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists)return doc.data().token;const token=crypto.randomBytes(24).toString('hex');tx.set(ref,{token});return token;});
  return JSON.stringify({kind:'ae_shop',merchantId,token});
}
function registerShopRequests(app, {database, supabase, customerAuth, auth, merchantRole, adminRole, push, background}) {
  const unavailable = res => res.status(503).json({error:'Shop checkout requests are unavailable. Please try again.'});
  if(adminRole)app.get('/api/admin/qr-merchants',auth,adminRole,async(req,res)=>{
    res.set('Cache-Control','no-store');
    const page=Math.floor(Math.max(1,Math.min(100000,Number(req.query.page)||1))),size=20,search=String(req.query.search||'').trim().slice(0,100);
    try {
      let query=supabase.from('active_merchants').select('id,name,merchant_code',{count:'exact'}).order('name').order('id');
      if(search)query=query.ilike('name',`%${search.replace(/[%_\\]/g,'\\$&')}%`);
      const {data,error,count}=await query.range((page-1)*size,page*size-1);
      if(error)return unavailable(res);
      res.json({merchants:data||[],total:count||0,page,pageSize:size});
    }catch{return unavailable(res);}
  });
  if(adminRole)app.get('/api/admin/merchants/:id/qr-poster',auth,adminRole,async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return res.status(400).json({error:'Invalid merchant ID'});
    try {
      const {data,error}=await supabase.from('active_merchants').select('id,name,merchant_code').eq('id',req.params.id).maybeSingle();
      if(error)return unavailable(res);
      if(!data)return res.status(404).json({error:'Merchant not found'});
      res.json({merchant:data,payload:await shopQrPayload(database,data.id)});
    }catch{return unavailable(res);}
  });
  app.get('/api/merchant/shop-qr',auth,merchantRole,async(req,res)=>{
    try {
      const merchantId=req.auth.profile.merchant_id;
      res.set('Cache-Control','no-store');
      res.json({payload:await shopQrPayload(database,merchantId)});
    }catch{return unavailable(res);}
  });
  app.post('/api/customer/shop-requests',customerAuth,async(req,res)=>{
    const {merchantId,token,action}=req.body;
    if(typeof merchantId!=='string'||! /^[a-f0-9-]{36}$/i.test(merchantId)||typeof token!=='string'||! /^[a-f0-9]{48}$/.test(token)||!validateAction(action))return res.status(400).json({error:'Scan a valid AE shop QR and choose a checkout action.'});
    try {
      const db=await database();
      const [qr,merchant]=await Promise.all([
        db.collection('ae_shop_qr').doc(merchantId).get(),
        supabase.from('active_merchants').select('id,name').eq('id',merchantId).maybeSingle(),
      ]);
      if(!qr.exists||qr.data().token!==token)return res.status(400).json({error:'Shop QR is not valid.'});
      if(merchant.error||!merchant.data)return res.status(404).json({error:'Shop unavailable.'});
      const key=crypto.createHash('sha256').update(req.customer.id+':'+merchantId).digest('hex');
      const lock=db.collection('ae_shop_request_locks').doc(key), ref=db.collection('ae_shop_requests').doc();
      const result=await db.runTransaction(async tx=>{
        const old=await tx.get(lock);
        if(old.exists){const existing=await tx.get(db.collection('ae_shop_requests').doc(old.data().requestId));if(existing.exists&&['processing','needs_review'].includes(existing.data().status))throw new Error('A checkout is being processed. Ask the merchant to check it.');if(existing.exists&&existing.data().status==='pending'&&existing.data().expiresAt>Date.now())return {id:existing.id,...existing.data(),fresh:false};}
        const row={merchantId,merchantName:merchant.data.name,customerId:req.customer.id,customerCode:req.customer.customer_code||req.customer.id,action,status:'pending',createdAt:Date.now(),expiresAt:Date.now()+TTL};
        tx.set(ref,row);tx.set(lock,{requestId:ref.id});return {id:ref.id,...row,fresh:true};
      });
      if(result.fresh)background(async()=>{
        try {
          const delivery=await push(merchantId,'New points checkout request',action==='combined'?'A customer requested to redeem points and earn points on a purchase. Review and confirm the checkout in AE.':'A customer requested points for a purchase. Review and confirm the checkout in AE.',{url:'/shop-checkout?request='+result.id,type:'shop_checkout',requestId:result.id});
          await ref.update({pushAttemptedAt:Date.now(),pushDelivery:delivery || {accepted:0,unknown:true}});
          if(!delivery?.accepted)console.warn('Shop QR push not accepted:',{requestId:result.id,...delivery});
        }catch(error){console.warn('Shop QR push failed:',{requestId:result.id,message:error.message});}
      });
      res.status(result.fresh?201:200).json({request:result});
    }catch(error){if(error.message.startsWith('A checkout'))return res.status(409).json({error:error.message});return unavailable(res);}
  });
  app.get('/api/customer/shop-requests/:id',customerAuth,async(req,res)=>{
    if(!/^[a-zA-Z0-9]{20}$/.test(req.params.id))return res.status(400).json({error:'Invalid request'});
    try{const db=await database(), doc=await db.collection('ae_shop_requests').doc(req.params.id).get();if(!doc.exists||doc.data().customerId!==req.customer.id)return res.status(404).json({error:'Request not found'});const row=doc.data();res.set('Cache-Control','no-store');res.json({request:{id:doc.id,...row,status:row.status==='pending'&&row.expiresAt<=Date.now()?'expired':row.status}});}catch{return unavailable(res);}
  });
  app.get('/api/merchant/shop-requests',auth,merchantRole,async(req,res)=>{
    try{const db=await database(), snapshot=await db.collection('ae_shop_requests').where('merchantId','==',req.auth.profile.merchant_id).where('status','==','pending').get();res.set('Cache-Control','no-store');res.json({requests:snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).filter(row=>row.expiresAt>Date.now()).map(({customerId,...row})=>row).sort((a,b)=>a.createdAt-b.createdAt)});}catch{return unavailable(res);}
  });
  // Claim once before invoking the existing checkout. A failed/uncertain checkout
  // stays locked so a retry cannot deduct points again; staff must reconcile it.
  app.post('/api/checkouts',auth,merchantRole,async(req,res,next)=>{
    const id=req.body.shopRequestId;if(!id)return next();
    if(!/^[a-zA-Z0-9]{20}$/.test(id))return res.status(400).json({error:'Invalid request'});
    const amount=Number(req.body.amount), rate=Number(req.body.rewardPercentage);
    if(!Number.isFinite(amount)||amount<1||!Number.isFinite(rate)||rate<1||rate>100)return res.status(400).json({error:'Enter a valid bill amount and reward rate.'});
    try{
      const db=await database(),ref=db.collection('ae_shop_requests').doc(id);
      await db.runTransaction(async tx=>{const doc=await tx.get(ref);const row=doc.exists?doc.data():null;assertPending(row,req.auth.profile.merchant_id);if(req.body.customerCode!==row.customerCode||Number(req.body.pointsToRedeem||0)!==(row.action==='combined'?100:0))throw new Error('Checkout does not match customer request');tx.update(ref,{status:'processing'});});
      req.headers['idempotency-key']='shop-'+id;
      res.once('finish',()=>background(()=>ref.update({status:res.statusCode<400?'completed':'needs_review',finishedAt:Date.now()}).catch(()=>{})));
      next();
    }catch(error){res.status(409).json({error:error.message});}
  });
}
module.exports={registerShopRequests,validateAction,assertPending,shopQrPayload};
