const STATUSES=['visited','interested','follow_up','not_interested','onboarded'];
function validateProspect(body){
 const text=(key,max)=>String(body?.[key]??'').trim().slice(0,max);
 const data={name:text('name',160),category:text('category',100),address:text('address',500),status:text('status',30),notes:text('notes',2000),follow_up_date:text('follow_up_date',10)};
 if(!data.name||!data.address)throw Error('Enter the shop name and address.');
 if(!STATUSES.includes(data.status))throw Error('Select a valid visit status.');
 for(const [key,max] of [['latitude',90],['longitude',180]]){
  if(body?.[key]==null||String(body[key]).trim()===''||!Number.isFinite(Number(body[key]))||Math.abs(Number(body[key]))>max)throw Error('Set a valid shop location on the map.');
  data[key]=Number(body[key]);
 }
 if(data.follow_up_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.follow_up_date)||new Date(data.follow_up_date+'T00:00:00Z').toISOString().slice(0,10)!==data.follow_up_date))throw Error('Select a valid follow-up date.');
 return data;
}
function registerShopProspects(app,{auth,database}){
 const permitted=(req,res,next)=>['admin','field_manager'].includes(req.auth.profile.role)?next():res.status(403).json({error:'Field Manager or Admin access required.'});
 const owner=(req,row)=>req.auth.profile.role==='admin'||row.manager_id===req.auth.profile.id;
 const collection=async()=> (await database()).collection('ae_shop_visit_tracking');
 app.get('/api/shop-visit-tracking',auth,permitted,async(req,res)=>{
  try{
   let query=await collection();
   if(req.auth.profile.role==='field_manager')query=query.where('manager_id','==',req.auth.profile.id);
   else if(req.query.managerId)query=query.where('manager_id','==',String(req.query.managerId).slice(0,120));
   // Sort and filter after the single ownership query; no composite index is needed.
   const snap=await query.get();
   let rows=snap.docs.map(doc=>({id:doc.id,...doc.data()}));
   const managers=[...new Map(rows.map(row=>[row.manager_id,{id:row.manager_id,name:row.manager_name}])).values()];
   if(req.query.status)rows=rows.filter(row=>row.status===req.query.status);
   if(req.query.from){const start=new Date(String(req.query.from)+'T00:00:00+05:30');if(!Number.isFinite(start.getTime()))return res.status(400).json({error:'Invalid date filter.'});rows=rows.filter(row=>new Date(row.created_at)>=start);}
   if(req.query.to){const end=new Date(String(req.query.to)+'T23:59:59.999+05:30');if(!Number.isFinite(end.getTime()))return res.status(400).json({error:'Invalid date filter.'});rows=rows.filter(row=>new Date(row.created_at)<=end);}
   rows.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
   const total=rows.length;return res.json({visits:rows.slice(0,500),total,managers});
  }catch{return res.status(503).json({error:'Shop visit tracking could not load. Please retry.'});}
 });
 app.get('/api/shop-visit-tracking/:id/history',auth,permitted,async(req,res)=>{
  try{const ref=(await collection()).doc(req.params.id),snap=await ref.get();if(!snap.exists)return res.status(404).json({error:'Shop visit not found.'});if(!owner(req,snap.data()))return res.status(403).json({error:'This visit belongs to another Field Manager.'});const history=await ref.collection('history').orderBy('at','desc').get();return res.json({events:history.docs.map(doc=>({id:doc.id,...doc.data()}))});}catch{return res.status(503).json({error:'Visit history could not load.'});}
 });
 app.post('/api/shop-visit-tracking',auth,permitted,async(req,res)=>{
  if(req.auth.profile.role!=='field_manager')return res.status(403).json({error:'Visits must be recorded from the Field Manager account.'});
  let data;try{data=validateProspect(req.body);}catch(error){return res.status(400).json({error:error.message});}
  try{
   const db=await database(),ref=db.collection('ae_shop_visit_tracking').doc(),at=new Date().toISOString();
   const row={...data,manager_id:req.auth.profile.id,manager_name:req.auth.profile.full_name||'Field Manager',created_at:at,updated_at:at};
   const batch=db.batch();batch.set(ref,row);batch.set(ref.collection('history').doc(),{...row,at,action:'created'});await batch.commit();return res.status(201).json({visit:{id:ref.id,...row}});
  }catch{return res.status(503).json({error:'Visit could not be saved. Please retry.'});}
 });
 app.put('/api/shop-visit-tracking/:id',auth,permitted,async(req,res)=>{
  if(req.auth.profile.role!=='field_manager')return res.status(403).json({error:'Only the recording Field Manager can update this visit.'});
  let data;try{data=validateProspect(req.body);}catch(error){return res.status(400).json({error:error.message});}
  try{
   const db=await database(),ref=db.collection('ae_shop_visit_tracking').doc(req.params.id);
   const result=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)return {status:404,error:'Shop visit not found.'};const old=snap.data();
    if(!owner(req,old))return {status:403,error:'This visit belongs to another Field Manager.'};
    if(req.body.updated_at!==old.updated_at)return {status:409,error:'This visit changed. Refresh before editing again.'};
    const at=new Date().toISOString(),row={...old,...data,updated_at:at};
    tx.set(ref,row);tx.set(ref.collection('history').doc(),{...row,at,action:'updated'});return {visit:{id:ref.id,...row}};
   });
   return result.error?res.status(result.status).json({error:result.error}):res.json(result);
  }catch{return res.status(503).json({error:'Visit could not be updated. Please retry.'});}
 });
}
module.exports={registerShopProspects,validateProspect,STATUSES};
