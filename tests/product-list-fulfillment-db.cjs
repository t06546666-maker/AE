const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create table customer_product_list_requests(id text primary key,status text check(status in ('pending','approved','rejected','accepted')), merchant_id text); insert into customer_product_list_requests values('legacy','accepted','shop1'),('pending','pending','shop1');");
 const sql=fs.readFileSync('supabase-product-list-fulfillment.sql','utf8'); await db.exec(sql); await db.exec(sql);
 assert.deepEqual((await db.query("select status,merchant_status from customer_product_list_requests where id='legacy'")).rows,[{status:'approved',merchant_status:'confirmed'}]);
 for(const status of ['confirmed','in_progress','ready','rejected']) await db.query("update customer_product_list_requests set merchant_status=$1 where id='legacy'",[status]);
 await assert.rejects(db.query("update customer_product_list_requests set merchant_status='bogus' where id='legacy'"));
 const pending=(await db.query("select status,merchant_status from customer_product_list_requests where id='pending'")).rows[0]; assert.deepEqual(pending,{status:'pending',merchant_status:null});
 await db.exec('set role authenticated'); await assert.rejects(db.query('select * from customer_product_list_requests')); await db.exec('reset role');
 await db.close(); console.log('PASS: additive migration, safe rerun, legacy acceptance, database status constraints and direct-client access blocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
