const crypto = require('node:crypto');
const validUpi = value => typeof value === 'string' && /^[a-zA-Z0-9._-]{2,128}@[a-zA-Z0-9.-]{2,64}$/.test(value);
function paymentDetails(settings, merchantName, payable) {
  if (settings?.enabled !== true || !validUpi(settings.upiId) || !Number.isFinite(payable) || payable <= 0) return null;
  const params = new URLSearchParams({pa:settings.upiId,pn:String(merchantName || 'Merchant').slice(0,100),am:payable.toFixed(2),cu:'INR',tn:'AE shop payment'});
  return {upiId:settings.upiId,qrUrl:settings.qrUrl || '',upiUrl:`upi://pay?${params}`};
}
function registerMerchantUpi(app,{auth,merchantRole,database,upload,uploadImage}) {
  const ref = async id => (await database()).collection('ae_merchant_payment_settings').doc(id);
  const read = async id => (await (await ref(id)).get()).data() || {};
  app.get('/api/merchant-profile/upi',auth,merchantRole,async(req,res)=>{
    if(!req.auth.profile.merchant_id)return res.status(403).json({error:'No shop is linked to this account.'});
    try {const data=await read(req.auth.profile.merchant_id);res.setHeader('Cache-Control','no-store');return res.json({upiId:data.upiId || '',qrUrl:data.qrUrl || '',enabled:data.enabled===true});}
    catch{return res.status(503).json({error:'Payment settings are unavailable. Please retry.'});}
  });
  app.put('/api/merchant-profile/upi',auth,merchantRole,async(req,res)=>{
    const id=req.auth.profile.merchant_id;
    if(!id)return res.status(403).json({error:'No shop is linked to this account.'});
    const upiId=String(req.body.upiId || '').trim();
    if(upiId && !validUpi(upiId))return res.status(400).json({error:'Enter a valid UPI ID, such as shop@bank.'});
    if(req.body.enabled===true && !validUpi(upiId))return res.status(400).json({error:'Add a valid UPI ID before enabling UPI payments.'});
    try {await (await ref(id)).set({upiId,enabled:req.body.enabled===true,updatedAt:Date.now(),updatedBy:req.auth.profile.id},{merge:true});return res.json({success:true});}
    catch{return res.status(503).json({error:'Could not save payment settings. Please retry.'});}
  });
  app.post('/api/merchant-profile/upi/qr',auth,merchantRole,upload.single('image'),async(req,res)=>{
    const id=req.auth.profile.merchant_id;
    if(!id)return res.status(403).json({error:'No shop is linked to this account.'});
    const file=req.file,types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
    if(!file || !types[file.mimetype])return res.status(400).json({error:'Choose a PNG, JPG or WebP QR image.'});
    const b=file.buffer,signature=file.mimetype==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.mimetype==='image/jpeg'?b[0]===255&&b[1]===216:b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
    if(!signature)return res.status(400).json({error:'This file is not a supported image.'});
    try {const url=await uploadImage(`merchant-payment-qr/${id}/${crypto.randomUUID()}.${types[file.mimetype]}`,b,file.mimetype);if(!url)throw Error('Upload unavailable');await (await ref(id)).set({qrUrl:url,updatedAt:Date.now(),updatedBy:req.auth.profile.id},{merge:true});return res.json({success:true,qrUrl:url});}
    catch{return res.status(503).json({error:'Could not save your QR image. Please retry.'});}
  });
  return {read,paymentDetails};
}
module.exports={validUpi,paymentDetails,registerMerchantUpi};
