function summarizeUsage(rows) {
 const users=new Set(),customers=new Set(),merchants=new Set(),web=new Set(),android=new Set();
 for(const row of rows) {
  users.add(row.actorKey);if(row.role==='customer')customers.add(row.actorKey);
  if(row.role==='merchant'&&row.merchantId)merchants.add(row.merchantId);
  if(row.platforms?.web)web.add(row.actorKey);if(row.platforms?.android)android.add(row.actorKey);
 }
 return {activeUsers:users.size,activeCustomers:customers.size,activeMerchants:merchants.size,websiteUsers:web.size,androidUsers:android.size};
}
module.exports={summarizeUsage};
