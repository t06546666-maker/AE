const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
const implementation=source.slice(source.indexOf('async function sendWhatsAppTemplate('),source.indexOf('async function sendRegistrationWhatsApp('));
async function run(){
 const logs=[],requests=[];const allowed=new Set(['order','qr','merchant_credentials','offer','customer_order','customer_order_status']);
 const db={from(){return {insert(row){logs.push(row);assert(allowed.has(row.message_type),'Must satisfy the deployed legacy check constraint');return this},select(){return this},async single(){return {data:{id:'log'},error:null}},update(){return this},async eq(){return {error:null}}}}};
 const axios={post:async(url,payload)=>{requests.push(payload);return {data:{messages:[{id:'meta-id'}]}}}};
 const send=new Function('WA_REGISTRATION_ONLY','WA_TOKEN','WA_PHONE_ID','WA_TEMPLATE_LANGUAGE','supabaseAdmin','axios','WA_URL','WA_REQUEST_TIMEOUT_MS',implementation+';return sendWhatsAppTemplate;')(false,'test','test','en',db,axios,'https://invalid.test',100);
 for(const type of ['registration','registration_password','merchant_credentials','order']){
  const result=await send({customerId:'customer',recipient:'test',messageType:type,templateName:type==='registration'?'ae_use':'test',components:[]});assert.equal(result.sent,true);
 }
 assert.deepEqual(logs.map(row=>row.message_type),['qr','qr','merchant_credentials','order']);
 assert.equal(logs[0].template_name,'ae_use');assert.equal(requests[0].template.name,'ae_use');assert.equal(requests[0].template.language.code,'en');
 console.log('PASS: real send path satisfies legacy log constraints while retaining the exact usage template and language');
}
run().catch(error=>{console.error(error);process.exitCode=1});
