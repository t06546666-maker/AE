const ACTIONS=new Set(['confirmed','returned','cancelled','needs_review','product_list_updated']);
function historyRow(doc){
 const row=doc.data(),result={id:doc.id,action:row.action,staffName:row.staffName||'',customerName:row.customerName||'',customerCode:row.customerCode||'',reason:row.reason||'',createdAt:row.createdAt,orderId:row.orderId||null,requestId:row.requestId||null};
 for(const key of ['amount','discountAmount','payable','pointsToEarn','pointsToRedeem'])if(Number.isFinite(row[key]))result[key]=row[key];
 return result;
}
const DAY=86400000,IST=19800000;
function historyRange(query={},now=Date.now()){
 const invalid=()=>Object.assign(Error('Choose a valid date range.'),{status:400});
 const range=query.range||'all';if(range==='all')return null;
 const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw invalid();const stamp=Date.parse(value+'T00:00:00+05:30');if(!Number.isFinite(stamp)||new Date(stamp+IST).toISOString().slice(0,10)!==value)throw invalid();return stamp;};
 const today=new Date(now+IST).toISOString().slice(0,10),start=day(today),local=new Date(start+IST);
 if(range==='today')return {start,end:start+DAY};
 if(range==='week')return {start:start-((local.getUTCDay()+6)%7)*DAY,end:start+DAY};
 if(range==='month')return {start:day(today.slice(0,8)+'01'),end:start+DAY};
 if(range!=='custom')throw invalid();const from=day(query.from),to=day(query.to);if(from>to)throw invalid();return {start:from,end:to+DAY};
}
async function readHistory(db,merchantId,staffId,cursor,range=null){
 const events=db.collection('ae_counter_activity').doc(merchantId).collection('events');let after=null;
 if(cursor){if(!/^[a-zA-Z0-9]{20}$/.test(cursor))throw Error('Invalid history cursor.');after=await events.doc(cursor).get();if(!after.exists)throw Error('History page not found. Refresh latest.');}
 const transactions=[];let scanned=0;
 // Scan bounded pages of the existing ordered audit stream. This needs no
 // new composite index and never imposes an all-time cap on staff history.
 while(scanned<250){let query=events.orderBy('createdAt','desc');if(range)query=query.where('createdAt','>=',range.start).where('createdAt','<',range.end);if(after)query=query.startAfter(after);const batch=await query.limit(50).get();if(!batch.docs.length)return {transactions,nextCursor:null};
  for(const doc of batch.docs){scanned++;after=doc;const row=doc.data();if(row.staffId===staffId&&ACTIONS.has(row.action))transactions.push(historyRow(doc));if(transactions.length===50)return {transactions,nextCursor:doc.id};}
  if(batch.docs.length<50)return {transactions,nextCursor:null};
 }
 return {transactions,nextCursor:after?.id||null};
}
function registerCounterHistory(app,{database,auth,merchantRole,staffAuth,ready}){
 app.get('/api/merchant/counter-staff/:staffId/history',auth,merchantRole,async(req,res)=>{
  res.set('Cache-Control','no-store');try{if(!/^[a-f0-9]{64}$/.test(req.params.staffId))return res.status(404).json({error:'Staff not found.'});const db=await database(),staff=await db.collection('ae_counter_staff').doc(req.params.staffId).get();if(!staff.exists||staff.data().merchantId!==req.auth.profile.merchant_id)return res.status(404).json({error:'Staff not found.'});res.json(await readHistory(db,req.auth.profile.merchant_id,staff.id,req.query.cursor,historyRange(req.query)));}catch(e){res.status(e.status||503).json({error:e.message||'Unable to load staff history.'});}
 });
 app.get('/api/counter/history',staffAuth,ready,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await readHistory(await database(),req.counter.merchantId,req.counter.id,req.query.cursor,historyRange(req.query)));}catch(e){res.status(e.status||503).json({error:e.message||'Unable to load staff history.'});}});
}
module.exports={registerCounterHistory,readHistory,historyRow,historyRange};
