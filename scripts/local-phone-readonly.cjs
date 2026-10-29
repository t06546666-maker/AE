// Temporary local inspection server. Never run as a hosted deployment.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const config=require('dotenv').parse(fs.readFileSync(path.join(root,'.env')));
if(new URL(config.SUPABASE_URL).hostname!=='zrsjgbgzkaxccetjahcy.supabase.co')throw Error('Expected AE production read-only data source');
for(const [key,value] of Object.entries(config))process.env[key]=value;
process.env.AE_ENV='local-readonly';
const express=require('express');
const preview=express();
preview.use((req,res,next)=>{
  res.setHeader('X-AE-Local-Preview','read-only');
  const allowed=['GET','HEAD','OPTIONS'].includes(req.method)
    || (req.method==='POST' && ['/api/auth/login','/api/auth/refresh'].includes(req.path));
  if(!allowed)return res.status(403).json({error:'Local read-only test: account changes, purchases, messages and consent recording are disabled.'});
  next();
});
preview.use(require('../server'));
preview.listen(3030,'127.0.0.1',()=>console.log('AE local read-only API ready on 127.0.0.1:3030. Live data; mutations blocked.'));
