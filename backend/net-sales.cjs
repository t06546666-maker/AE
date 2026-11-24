const {orderRewardDetails}=require('./order-reward-details.cjs');
function salesAmount(order,details){
 const gross=Number(order.amount||0),discount=details?.discountAmount;
 // Preserve legacy sales when no reliable checkout snapshot was recorded.
 return typeof discount==='number'&&Number.isFinite(discount)&&discount>=0&&discount<=gross
  ? Math.round((gross-discount)*100)/100:gross;
}
async function netSales(db,orders){
 const details=await orderRewardDetails(db,orders);
 return Math.round(orders.reduce((sum,order)=>sum+Math.round(salesAmount(order,details.get(order.id))*100),0))/100;
}
module.exports={salesAmount,netSales};
