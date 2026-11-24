function registerDeletedMerchants(app,{db,auth,adminRole}) {
 app.get('/api/admin/deleted-merchants',auth,adminRole,async(req,res)=>{
  try {
   const page=Math.max(1,Math.min(100000,parseInt(req.query.page,10)||1)),pageSize=20;
   const search=String(req.query.search||'').trim().slice(0,100).replace(/[%_]/g,'');
   let query=db.from('merchants').select('id,name,merchant_code,email,phone,address,deleted_at',{count:'exact'}).not('deleted_at','is',null);
   if(search)query=query.ilike('name',`%${search}%`);
   const {data,error,count}=await query.order('deleted_at',{ascending:false}).order('id').range((page-1)*pageSize,page*pageSize-1);
   if(error)throw error;
   res.json({merchants:data||[],pagination:{page,pageSize,total:count||0,totalPages:Math.max(1,Math.ceil((count||0)/pageSize))}});
  }catch{res.status(503).json({error:'Deleted merchants are unavailable. Please retry.'});}
 });
 app.post('/api/admin/merchants/:id/archive',auth,adminRole,async(req,res)=>{
  const id=String(req.params.id||'');
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)||req.body?.confirmation!=='DELETE')return res.status(400).json({error:'Confirm merchant removal first.'});
  try {
   const {error}=await db.rpc('admin_archive_merchant',{p_admin:req.auth.profile.id,p_merchant:id});
   if(error)return res.status(error.code==='P0002'?404:error.code==='42501'?403:503).json({error:'Merchant removal could not be completed. No account data was erased.'});
   res.json({success:true,archived:true});
  }catch{res.status(503).json({error:'Could not confirm removal. Refresh before retrying.'});}
 });
}
module.exports={registerDeletedMerchants};
