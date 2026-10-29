const states=['draft','submitted','corrections','approved','rejected','paid','cancelled'];
function summarize(rows){
 const totals={requested:0n,approved:0n,paid:0n,outstanding:0n};
 for(const row of rows){const value=BigInt(row.amount_paise);if(!['draft','cancelled'].includes(row.status))totals.requested+=value;if(['approved','paid'].includes(row.status))totals.approved+=value;if(row.status==='paid')totals.paid+=value;if(row.status==='approved')totals.outstanding+=value;}
 return Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,value.toString()]));
}
function filters(query,input,fail,{summary=false}={}){
 if(input.department){if(!['Accounts','Developer','Field Manager','HR','Marketing','Other'].includes(input.department))fail('Invalid department.');query=query.eq('department',input.department);}
 if(input.employee){if(!/^[0-9a-f-]{36}$/i.test(input.employee))fail('Invalid employee.');query=query.eq('owner_id',input.employee);}
 if(summary){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month||''))fail('Choose a valid month.');const [year,month]=input.month.split('-').map(Number);const end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);return query.gte('expense_date',input.month+'-01').lte('expense_date',end);}
 if(input.bucket&&!['requests','pending','history'].includes(input.bucket))fail('Invalid accounts section.');
 if(input.bucket==='requests')query=query.in('status',['submitted','corrections','rejected']);
 if(input.bucket==='pending')query=query.eq('status','approved');
 if(input.bucket==='history')query=query.eq('status','paid');
 if(input.status){if(!states.includes(input.status))fail('Invalid status.');query=query.eq('status',input.status);}
 for(const [key,op]of [['from','gte'],['to','lte']])if(input[key]){if(!/^\d{4}-\d{2}-\d{2}$/.test(input[key])||!Number.isFinite(Date.parse(input[key]))||new Date(input[key]).toISOString().slice(0,10)!==input[key])fail('Invalid date filter.');query=query[op](input.bucket==='history'?'payment_date':'expense_date',input[key]);}
 if(input.from&&input.to&&input.from>input.to)fail('From date must not be after To date.');
 return query;
}
module.exports={summarize,filters};
