// Only called after the atomic database removal. A durable job allows retry
// without repeating account removal or touching customer history.
async function cleanupMerchantRemoval({db,database,merchantId}) {
 try {
  const job=await db.from('merchant_removal_jobs').select('profile_ids,image_urls,completed_at').eq('merchant_id',merchantId).maybeSingle();
  if(job.error||!job.data)return false;
  if(job.data.completed_at)return true;
  const firestore=await database();
  await firestore.collection('ae_shop_qr').doc(merchantId).delete();
  for(const id of job.data.profile_ids||[]) {
   await firestore.collection('ae_profile_push_registrations').doc(id).delete();
   await firestore.recursiveDelete(firestore.collection('ae_profile_notification_inboxes').doc(id));
  }
  const targets=await firestore.collection('ae_sales_targets').where('merchantId','==',merchantId).get();
  for(const doc of targets.docs)await doc.ref.delete();
  const requests=await firestore.collection('ae_shop_requests').where('merchantId','==',merchantId).get();
  for(const doc of requests.docs)await doc.ref.update({merchantName:'Deleted merchant',...(doc.data().status==='pending'?{status:'cancelled'}:{})});
  const urls=job.data.image_urls||[];
  if(urls.length) {
   const origin=new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL).origin;
   const resource=value=>{
    try {
     const url=new URL(value);if(url.origin!==origin)return null;
     const match=url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
     if(!match)return null;
     const bucket=decodeURIComponent(match[1]),path=decodeURIComponent(match[2]);
     if(!path.startsWith('shops/')||path.split('/').some(part=>part==='..'||part==='.'))return null;
     return {bucket,path,key:bucket+'/'+path};
    }catch{return null;}
   };
   const shared=new Set();
   for(let offset=0;;offset+=500){
    const shops=await db.from('active_merchants').select('image_url,images').order('id').range(offset,offset+499);
    if(shops.error)throw Error('Image ownership check failed');
    for(const row of shops.data||[])for(const value of [row.image_url,...(Array.isArray(row.images)?row.images:[])]){
     const file=resource(value);if(file)shared.add(file.key);
    }
    if((shops.data||[]).length<500)break;
   }
   for(const value of urls) {
    const file=resource(value);if(!file||shared.has(file.key))continue;
    const removed=await db.storage.from(file.bucket).remove([file.path]);if(removed.error)throw removed.error;
   }
  }
  const done=await db.from('merchant_removal_jobs').update({completed_at:new Date().toISOString(),image_urls:[]}).eq('merchant_id',merchantId);
  if(done.error)throw done.error;
  return true;
 }catch(error){console.warn('Merchant removal cleanup pending:',{merchantId,message:error.message});return false;}
}
module.exports={cleanupMerchantRemoval};
