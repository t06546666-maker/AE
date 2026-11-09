const {registerProductListFulfillment, LABELS}=require('./product-list-fulfillment.cjs');
function productListView(row,imageUrl){
 let text=row.product_list||'',pickup=row.pickup_time||null;
 if(!pickup){const match=text.match(/^\[Pickup Time: ([^\]]+)\]\n?/);if(match){pickup=match[1];text=text.slice(match[0].length);}}
 return {id:row.id,product_list:text,pickup_time:pickup,status:row.merchant_status||row.status,created_at:row.created_at,customerName:row.customers?.name||'Customer',image_url:imageUrl};
}
async function notifyCounterProductList({database,sendPush},merchantId,id){
 const db=await database(),rows=await db.collection('ae_counter_staff').where('merchantId','==',merchantId).get();
 await Promise.allSettled(rows.docs.filter(doc=>{const s=doc.data();return s.enabled&&!s.mustChangePassword&&s.push_enabled!==false&&s.push_token;}).map(doc=>sendPush(doc.data().push_token,'New product list','A customer product list is ready to review in AE.',{url:'/counter?view=product-lists&requestId='+encodeURIComponent(id),type:'product_list',requestId:id})));
}
function registerCounterProductLists(app,{staffAuth,ready,db,database,imageUrl,pushToCustomer,pushToMerchant,pushToRole}){
 app.get('/api/counter/product-lists',staffAuth,ready,async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{
   const fields='id,product_list,image_path,merchant_status,status,created_at,customers(name)';
   const query=extra=>db.from('customer_product_list_requests').select(fields+extra).eq('merchant_id',req.counter.merchantId).eq('status','approved').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(200);
   let result=await query(',pickup_time');
   if(result.error&&(result.error.code==='42703'||String(result.error.message).includes('pickup_time')))result=await query('');
   if(result.error)throw Error('Unable to load product lists. Please retry.');
   const requests=await Promise.all((result.data||[]).map(async row=>productListView(row,row.image_path?await imageUrl(row.image_path):'')));
   res.json({requests});
  }catch(e){res.status(503).json({error:e.message||'Unable to load product lists.'});}
 });
 registerProductListFulfillment(app,{requireAuth:staffAuth,requireRole:()=>ready,db,pushToCustomer,pushToRole,path:'/api/counter/product-lists/:id/status',merchantFor:req=>req.counter.merchantId,
  beforeUpdate:async(req,{id,status})=>{const store=await database(),ref=store.collection('ae_counter_activity').doc(req.counter.merchantId).collection('events').doc();await ref.set({action:'product_list_update_started',staffId:req.counter.id,staffName:req.counter.name,actorRole:'counter_staff',productListId:id,reason:'Product list: '+LABELS[status],createdAt:Date.now()});return ref;},
  afterUpdate:async(req,{id,status,audit})=>{await Promise.allSettled([audit.update({action:'product_list_updated',completedAt:Date.now()}),pushToMerchant(req.counter.merchantId,'Product list: '+LABELS[status],req.counter.name+' updated a customer product list.',{url:'/customer-orders?view=product-lists&requestId='+encodeURIComponent(id),requestId:id,type:'product_list',status})]);}
 });
}
module.exports={registerCounterProductLists,notifyCounterProductList,productListView};
