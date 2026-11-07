// Called only by the narrowly authorized scheduled GitHub workflow. Never log credentials or recipients.
const fs=require('node:fs');
async function run(){
 const dryRun=process.env.REMINDER_DRY_RUN==='true';
 const tokenUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);tokenUrl.searchParams.set('audience','ae-merchant-daily-reminders');
 const tokenResponse=await fetch(tokenUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!tokenResponse.ok)throw Error('Could not obtain scheduler identity');
 const {value:token}=await tokenResponse.json();let after=null;let pages=0;
 const total={accepted:0,failed:0,disabled:0,missingToken:0,duplicate:0,eligible:0};let message;
 do{
  const response=await fetch('https://www.affiliateae.co.in/api/internal/merchant-daily-reminders',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({dryRun,after}),signal:AbortSignal.timeout(65000)});
  if(!response.ok)throw Error('Reminder endpoint returned '+response.status);
  const data=await response.json();if(data.outsideWindow){console.log('Outside the scheduled India-time hour; no reminders sent.');return;}
  message=data;for(const key of Object.keys(total))total[key]+=data.counts[key]||0;after=data.nextCursor;pages++;
  if(pages>=500&&after)throw Error('Reminder page limit reached');
 }while(after);
 const summary=(dryRun?'DRY RUN — no messages sent':'Scheduled reminders')+'\n'+message.date+' '+message.slot+' (Asia/Kolkata)\n'+message.title+'\n'+message.body+'\n'+JSON.stringify(total)+'\nFirebase acceptance is not proof of phone delivery.\n';
 console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 if(total.failed)process.exitCode=1;
}
run().catch(error=>{console.error(error.message);process.exitCode=1});
