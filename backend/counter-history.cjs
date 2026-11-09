const ACTIONS=new Set(['confirmed','returned','cancelled','needs_review','product_list_updated']);
function historyRow(doc){
 const row=doc.data(),result={id:doc.id,action:row.action,staffName:row.staffName||'',customerName:row.customerName||'',customerCode:row.customerCode||'',reason:row.reason||'',createdAt:row.createdAt,orderId:row.orderId||null,requestId:row.requestId||null};
 for(const key of ['amount','discountAmount','payable','pointsToEarn','pointsToRedeem'])if(Number.isFinite(row[key]))result[key]=row[key];
 return result;
}
async function readHistory(db,merchantId,staffId,cursor){
 const events=db.collection('ae_counter_activity').doc(merchantId).collection('events');let after=null;
 if(cursor){if(!/^[a-zA-Z0-9]{20}$/.test(cursor))throw Error('Invalid history cursor.');after=await events.doc(cursor).get();if(!after.exists)throw Error('History page not found. Refresh latest.');}
 const transactions=[];let scanned=0;
 // Scan bounded pages of the existing ordered audit stream. This needs no
 // new composite index and never imposes an all-time cap on staff history.
 while(scanned<250){let query=events.orderBy('createdAt','desc');if(after)query=query.startAfter(after);const batch=await query.limit(50).get();if(!batch.docs.length)return {transactions,nextCursor:null};
  for(const doc of batch.docs){scanned++;after=doc;const row=doc.data();if(row.staffId===staffId&&ACTIONS.has(row.action))transactions.push(historyRow(doc));if(transactions.length===50)return {transactions,nextCursor:doc.id};}
  if(batch.docs.length<50)return {transactions,nextCursor:null};
 }
 return {transactions,nextCursor:after?.id||null};
}
function registerCounterHistory(app,{database,auth,merchantRole,staffAuth,ready}){
 app.get('/api/merchant/counter-staff/:staffId/history',auth,merchantRole,async(req,res)=>{
  res.set('Cache-Control','no-store');try{if(!/^[a-f0-9]{64}$/.test(req.params.staffId))return res.status(404).json({error:'Staff not found.'});const db=await database(),staff=await db.collection('ae_counter_staff').doc(req.params.staffId).get();if(!staff.exists||staff.data().merchantId!==req.auth.profile.merchant_id)return res.status(404).json({error:'Staff not found.'});res.json(await readHistory(db,req.auth.profile.merchant_id,staff.id,req.query.cursor));}catch(e){res.status(503).json({error:e.message||'Unable to load staff history.'});}
 });
 app.get('/api/counter/history',staffAuth,ready,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await readHistory(await database(),req.counter.merchantId,req.counter.id,req.query.cursor));}catch(e){res.status(503).json({error:e.message||'Unable to load staff history.'});}});
}
module.exports={registerCounterHistory,readHistory,historyRow};
