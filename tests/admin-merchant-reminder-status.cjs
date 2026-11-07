const assert=require('node:assert/strict');
const {registerAdminReminderStatus,summarizeSlot,validDate,scanComplete}=require('../backend/admin-merchant-reminder-status.cjs');
async function run(){
 const date='2026-11-07',now=new Date('2026-11-07T05:00:00Z');
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate(date),true);assert.equal(validDate('not-a-date'),false);
 assert.equal(summarizeSlot(date,'afternoon',[],[],now).status,'scheduled');
 assert.equal(summarizeSlot(date,'morning',[],[],new Date('2026-11-07T03:45:00Z')).status,'waiting');
 assert.equal(summarizeSlot(date,'morning',[],[],now).status,'no_record');
 assert.equal(scanComplete([{id:'start',nextCursor:'two'},{id:'two',nextCursor:'start'}]),false);
 const rows=[{slot:'morning',status:'accepted',created_at:'2026-11-07T03:31:00Z',updated_at:'2026-11-07T03:31:01Z',body:'Actual sent wording'},{slot:'evening',status:'accepted'}];
 let result=summarizeSlot(date,'morning',rows,[{id:'start',nextCursor:null,missingToken:2,disabled:1}],now);
 assert.equal(result.status,'sent');assert.equal(result.accepted,1);assert.equal(result.missingToken,2);assert.equal(result.disabled,1);assert.equal(result.lastSentAt,'2026-11-07T03:31:01Z');assert.equal(result.messages[0],'Actual sent wording');assert.equal(result.messageRecorded,true);
 assert.equal(summarizeSlot(date,'morning',rows,[{id:'start',nextCursor:'unfinished'}],now).status,'partial');
 assert.equal(summarizeSlot(date,'morning',[...rows,{slot:'morning',status:'failed_or_unconfirmed'}],[{id:'start',nextCursor:null}],now).status,'partial');
 assert.equal(summarizeSlot(date,'morning',[{slot:'morning',status:'sending'}],[],now).status,'unconfirmed');
 assert.equal(summarizeSlot(date,'morning',[{slot:'morning',status:'failed_or_unconfirmed'}],[],now).status,'failed');
 assert.equal(summarizeSlot(date,'morning',[],[{id:'start',nextCursor:null,missingToken:3}],now).status,'no_eligible');
 let handler,reads=0,fail=false;const auth=()=>{},admin=()=>{};
 const db={collection(){return {where(){return this},doc(){return this},collection(){return this},async get(){reads++;if(fail)throw Error('unavailable');return {docs:[]}}}}};
 registerAdminReminderStatus({get(route,...middleware){assert.equal(route,'/api/admin/merchant-reminder-status');assert.equal(middleware[0],auth);assert.equal(middleware[1],admin);handler=middleware[2]}},{auth,adminRole:admin,firestore:async()=>db,now:()=>now});
 const call=async query=>{let code=200,data;await handler({query},{set(){},status(c){code=c;return this},json(d){data=d;return this}});return {code,data}};
 assert.equal((await call({date:'bad'})).code,400);assert.equal((await call({date:'2026-11-08'})).code,400);assert.equal(reads,0);
 result=await call({date});assert.equal(result.data.slots.length,3);assert.equal(result.data.slots[0].status,'no_record');assert.equal(result.data.slots[0].messageRecorded,false);
 fail=true;assert.equal((await call({date})).code,503);
 console.log('PASS: Admin-only read route, date validation, real accepted counts/timestamps, partial and failed sends, missing records, immutable message copy and unavailable-audit handling');
}
run().catch(error=>{console.error(error);process.exitCode=1});
