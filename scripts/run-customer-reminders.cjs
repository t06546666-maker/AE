const fs=require('node:fs');
async function run(){
 const dryRun=process.env.REMINDER_DRY_RUN==='true';let after=null,pages=0,last;
 const totals={pushAccepted:0,whatsappAccepted:0,failed:0,skipped:0,duplicate:0,eligiblePush:0,eligibleWhatsApp:0};
 do{
  // Renew identity per page; no long-lived scheduler secret is stored.
  const tokenUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);tokenUrl.searchParams.set('audience','ae-customer-daily-reminders');
  const identity=await fetch(tokenUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});if(!identity.ok)throw Error('Scheduler identity unavailable');const {value:token}=await identity.json();
  const r=await fetch('https://www.affiliateae.co.in/api/internal/customer-daily-reminders',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({dryRun,after}),signal:AbortSignal.timeout(65000)});if(!r.ok)throw Error('Customer reminder endpoint returned '+r.status);
  last=await r.json();if(last.outsideWindow||last.notStarted){console.log('No messages: outside the scheduled window or before the configured start date.');return;}
  for(const key of Object.keys(totals))totals[key]+=last.counts[key]||0;after=last.nextCursor;if(++pages>=1000&&after)throw Error('Customer reminder page limit reached');
 }while(after);
 const summary=(dryRun?'DRY RUN — no messages sent':'Customer reminders')+'\n'+last.date+' '+last.slot+' (India time)\n'+JSON.stringify(totals)+'\nAcceptance is not proof of phone delivery.\n';console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);if(totals.failed)process.exitCode=1;
}
run().catch(e=>{console.error(e.message);process.exitCode=1});
