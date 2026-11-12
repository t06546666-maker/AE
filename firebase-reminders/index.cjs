const {onSchedule}=require('firebase-functions/v2/scheduler');
const {GoogleAuth}=require('google-auth-library');
const endpoint='https://www.affiliateae.co.in/api/internal/firebase-customer-reminders';
async function run(slot){
 const client=await new GoogleAuth().getIdTokenClient(endpoint);
 let after=null, pages=0;
 do {
  const response=await client.request({url:endpoint,method:'POST',data:{slot,after},timeout:65000});
  const result=response.data;
  console.log(JSON.stringify({slot,date:result.date,counts:result.counts}));
  after=result.nextCursor;
  if(++pages>1000)throw Error('Reminder page limit exceeded');
 }while(after);
}
const options={region:'asia-south1',timeZone:'Asia/Kolkata',timeoutSeconds:540,memory:'256MiB',maxInstances:1,retryCount:2};
exports.customerMorning=onSchedule({...options,schedule:'0 10 * * *'},()=>run('morning'));
exports.customerEvening=onSchedule({...options,schedule:'0 17 * * *'},()=>run('evening'));
