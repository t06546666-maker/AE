// Local visual-QA fixture only. Never imported by server.js; no production accounts or database access.
const express=require('express'),fs=require('node:fs'),path=require('node:path');
const app=express();app.use(express.json());app.use((req,res,next)=>{res.set('Access-Control-Allow-Origin','http://127.0.0.1:3000');res.set('Access-Control-Allow-Headers','content-type,authorization');res.set('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next()});
const users={developer:{id:'11111111-1111-4111-8111-111111111111',full_name:'Demo Employee',email:'developer@example.test',role:'staff',merchant_id:null},accounts:{id:'22222222-2222-4222-8222-222222222222',full_name:'Demo Account Head',email:'accounts@example.test',role:'account_head',merchant_id:null}};
const claims=[{id:'33333333-3333-4333-8333-333333333333',owner_id:users.developer.id,department:'Developer',category:'IT Support',amount_paise:125050,expense_date:'2026-10-19',reason:'Software support for company devices',missing_receipt_reason:'Receipt requested from vendor',status:'submitted',version:2,profiles:{full_name:'Demo Employee'}}];
users.admin={id:'44444444-4444-4444-8444-444444444444',full_name:'Demo Admin',email:'admin@example.test',role:'admin',merchant_id:null};
app.get('/api/admin/expense-staff',(_req,res)=>res.json({employees:[{profile_id:users.accounts.id,department:'Other',active:true,profiles:users.accounts},{profile_id:users.developer.id,department:'Developer',active:true,profiles:users.developer}]}));
app.get('/api/admin/expense-staff/:id',(req,res)=>res.json({email:Object.values(users).find(user=>user.id===req.params.id)?.email||''}));
const token=user=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:4102444800})).toString('base64url')+'.preview';
const user=req=>{try{const id=JSON.parse(Buffer.from(req.headers.authorization.split('.')[1],'base64url').toString()).sub;return Object.values(users).find(u=>u.id===id)}catch{return null}};
app.post('/api/expenses/login',(req,res)=>{const selected=req.body.email==='admin@example.test'?users.admin:req.body.portal==='accounts'?users.accounts:users.developer;res.json({user:selected,accessToken:token(selected),refreshToken:'preview-only'})});
app.get('/api/auth/me',(req,res)=>res.json({user:user(req)}));
app.get('/api/profile/legal',(_req,res)=>res.json({enabled:false,accepted:false}));
app.get('/api/status',(_req,res)=>res.json({supabase:false,resend:false,whatsapp:false}));
app.get('/api/languages/:locale',(req,res)=>res.json({schemaVersion:1,locale:req.params.locale,translations:require('../backend/locales/'+(req.params.locale==='ml'?'ml':'en')+'.json')}));
app.get('/api/notifications',(_req,res)=>res.json({notifications:[],unreadCount:0}));
for(const prefix of ['/api/expenses','/api/accounts']){
 app.get(prefix+'/me',(_req,res)=>res.json({department:'Developer'}));
 app.get(prefix+'/claims',(_req,res)=>res.json({claims:[],total:0,summary:{}}));
 app.get(prefix+'/claims/:id',(_req,res)=>res.json({claim:claims[0],receipts:[],audit:[{id:'a',action:'submit',created_at:'2026-10-19T05:00:00Z',snapshot:{claim:claims[0]}}]}));
}
app.get('/api/accounts/employees',(_req,res)=>res.json({employees:[{profile_id:users.developer.id,profiles:{full_name:'Demo Employee'}}]}));
app.get('/api/accounts/summary',(req,res)=>res.json({month:req.query.month,totals:{requested:'0',approved:'0',paid:'0',outstanding:'0'}}));
app.get('/api/accounts/report',(_req,res)=>res.json({claims:[],total:0}));
app.use('/api',(_req,res)=>res.status(404).json({error:'Preview fixture: action not enabled'}));
const root=path.resolve(__dirname,'../dist');app.use(express.static(root));app.get(/.*/,(_req,res)=>res.type('html').send(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<body>','<body><div style="background:#fff1b8;color:#142b4b;padding:8px;text-align:center">LOCAL PREVIEW — TEST DATA ONLY</div>')));
app.listen(3000,'127.0.0.1',()=>console.log('Expense visual preview: http://127.0.0.1:3000/expenses (fixture data only)'));
