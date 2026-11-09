import {apiFetch} from '../api';
import type {Customer,Order,Pagination} from '../types';
type Raw=Record<string,any>;
export async function loadAdminMerchantOverview(merchantId:string,signal:AbortSignal){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId))throw Error('Invalid merchant');
 async function pages(type:'orders'|'customers'){
  const page=async(n:number)=>apiFetch<{records:Raw[];pagination:Pagination}>(`/api/admin/merchants/${encodeURIComponent(merchantId)}/activity?type=${type}&page=${n}&pageSize=100`,{signal});
  const first=await page(1),rows=[...first.records];
  for(let n=2;n<=first.pagination.totalPages;n+=4){const results=await Promise.all(Array.from({length:Math.min(4,first.pagination.totalPages-n+1)},(_,i)=>page(n+i)));results.forEach(result=>rows.push(...result.records));}
  return rows;
 }
 const [orders,customers]=await Promise.all([pages('orders'),pages('customers')]);
 return {orders:orders.map(row=>({id:row.id,orderNo:row.order_no,cid:row.customers?.customer_code||'',customer:row.customers?.name||'',phone:row.customers?.phone||'',email:row.customers?.email||'',amount:Number(row.amount||0),merchant:'',location:row.location||'',rewardPoints:Number(row.reward_points||0),rewardPercentage:Number(row.reward_percentage||0),isReturning:!!row.is_returning,source:row.source,timestamp:row.created_at,whatsappStatus:'not_sent',emailSent:!!row.email_sent} as Order)),customers:customers.filter(row=>row.customers).map(row=>({id:row.customers.customer_code,databaseId:row.customer_id,name:row.customers.name,phone:row.customers.phone||'',email:row.customers.email||'',registeredAt:row.joined_at||row.customers.created_at,qrScans:Number(row.qr_scans||0),rewardPoints:Number(row.reward_points||0),merchantId,merchant:''} as Customer))};
}
