function summarizeAndroidAccounts(rows,registry={}) {
 const merchants=new Set(),customers=new Set();
 for(const row of rows){
  if(row.platforms?.android!==true)continue;
  if(row.role==='merchant'&&typeof row.merchantId==='string'&&row.merchantId){if(!registry.merchantIds||registry.merchantIds.has(row.merchantId))merchants.add(row.merchantId);}
  if(row.role==='customer'&&typeof row.actorKey==='string'&&row.actorKey){if(!registry.customerIds||registry.customerIds.has(row.actorKey.replace(/^customer:/,'')))customers.add(row.actorKey);}
 }
 return {merchantAppUsers:merchants.size,customerAppUsers:customers.size};
}
module.exports={summarizeAndroidAccounts};
