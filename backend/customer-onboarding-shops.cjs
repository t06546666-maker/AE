// Original registration attribution only: linked/visited shops are not onboarding evidence.
async function withOnboardingShops(db,customers){
 const ids=[...new Set(customers.filter(c=>c.registration_source!=='self'&&c.merchant_id).map(c=>c.merchant_id))];
 const shops=new Map();
 if(ids.length){
  const result=await db.from('merchants').select('id,name,merchant_code').in('id',ids);
  if(result.error)throw result.error;
  for(const shop of result.data||[])shops.set(shop.id,{id:shop.id,name:shop.name,merchant_code:shop.merchant_code});
 }
 return customers.map(c=>({...c,onboardingMerchant:c.registration_source==='self'?null:shops.get(c.merchant_id)||null}));
}
module.exports={withOnboardingShops};
