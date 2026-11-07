// Local-only review server. No .env, production databases or external messages.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),express=require('express');
const root=path.resolve(__dirname,'..');process.chdir(root);
const {registerCounterStaff,passwordRecord}=require('../backend/counter-staff.cjs');
const source=fs.readFileSync(path.join(root,'tests/counter-staff.cjs'),'utf8');
const memoryDatabase=new Function(source.slice(source.indexOf('function memoryDatabase()'),source.indexOf('async function run()'))+';return memoryDatabase;')();
async function run(){
 const db=memoryDatabase(),shopId='11111111-1111-4111-8111-111111111111',staffPhone='9999999999',staffId=crypto.createHash('sha256').update('91'+staffPhone).digest('hex'),secret=crypto.randomBytes(48).toString('hex'),notices=[];
 await db.collection('ae_counter_staff').doc(staffId).set({id:staffId,name:'Demo employee',phone:'91'+staffPhone,merchantId:shopId,merchantName:'Demo Store',...await passwordRecord('CounterDemo1'),enabled:true,mustChangePassword:false,version:1,push_enabled:false,createdAt:Date.now()});
 await db.collection('ae_counter_settings').doc(shopId).set({enabled:true,pointsPer100:10,discountType:'percentage',discountValue:5,minimumBillAmount:1});
 await db.collection('ae_shop_qr').doc(shopId).set({token:'demo-qr-token'});
 const app=express();app.use(express.json());
 const auth=(req,res,next)=>{req.auth={profile:{id:'demo-owner',merchant_id:shopId,role:'merchant',full_name:'Demo owner'}};next();};
 const customerAuth=(req,res,next)=>{req.customer={id:'demo-customer',customer_code:'DEMO-001',name:'Demo customer'};next();};
 const merchantRole=(req,res,next)=>next();
 const supabase={from(){let id;return {select(){return this},eq(key,value){id=value;return this},async maybeSingle(){return {data:id===shopId?{id:shopId,name:'Demo Store'}:null}}}}};
 registerCounterStaff(app,{database:async()=>db,supabase,auth,merchantRole,customerAuth,normalizePhone:value=>{const digits=String(value||'').replace(/\D/g,'');return /^\d{10}$/.test(digits)?'91'+digits:/^91\d{10}$/.test(digits)?digits:'';},signingSecret:()=>secret,discount:(amount,type,value)=>({amount:Math.min(amount,type==='flat'?value:Math.round(amount*value)/100)}),points:(amount,rate)=>amount<10?1:amount<50?2:amount<100?5:Math.min(100,Math.round(amount*rate)/100),checkout:async args=>({status:201,body:{success:true,purchase:{order_id:'demo-order-'+args.requestId,points_earned:args.quote.pointsToEarn}}}),pushCustomer:async(id,title,body)=>notices.push({title,body}),sendPush:async()=>true,background:fn=>void Promise.resolve().then(fn).catch(console.error)});
 app.get('/api/languages/:locale',(req,res)=>{const locale=req.params.locale==='ml'?'ml':'en';res.json({locale,schemaVersion:1,translations:require('../backend/locales/'+locale+'.json')});});
 app.get('/api/customer/shop-requests/:id',customerAuth,async(req,res)=>{const doc=await db.collection('ae_shop_requests').doc(req.params.id).get();if(!doc.exists)return res.status(404).json({error:'Request not found'});res.json({request:{id:doc.id,...doc.data()}});});
 app.get('/api/demo/customer',async(req,res)=>res.json({notices,requests:[...db.rows.entries()].filter(([key])=>key.startsWith('ae_shop_requests/')).map(([key,row])=>({id:key.split('/').at(-1),...row})).sort((a,b)=>b.createdAt-a.createdAt)}));
 app.use('/api',(req,res)=>res.status(404).json({error:'This operation is not part of the local demo.'}));
 const {createServer}=await import('vite');const {default:react}=await import('@vitejs/plugin-react');
 const vite=await createServer({root,configFile:false,envDir:false,plugins:[react()],define:{'import.meta.env.VITE_API_URL':'""'},server:{middlewareMode:true,hmr:false},appType:'custom'});
 app.use(vite.middlewares);
 const html=fs.readFileSync(path.join(root,'scripts/counter-local-demo.html'),'utf8');
 app.use(async(req,res,next)=>{if(req.method!=='GET')return next();try{res.type('html').send(await vite.transformIndexHtml(req.originalUrl,html));}catch(error){vite.ssrFixStacktrace(error);next(error);}});
 const port=Number(process.env.COUNTER_DEMO_PORT||3036);app.listen(port,'127.0.0.1',()=>console.log('Counter Staff local demo: http://127.0.0.1:'+port+'/owner (sample data only; demo mobile 9999999999, password CounterDemo1)'));
}
run().catch(error=>{console.error(error);process.exitCode=1});
