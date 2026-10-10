function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('Choose a valid month.');
  const next=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1));
  return {from:`${month}-01T00:00:00+05:30`,to:`${next.toISOString().slice(0,10)}T00:00:00+05:30`};
}
function progress(target,sales) {
  const valid=Number.isFinite(target)&&target>0;
  return {target:valid?target:null,sales,remaining:valid?Math.max(0,target-sales):null,percent:valid?Math.min(100,Math.max(0,sales/target*100)):0,achieved:valid&&sales>=target};
}
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || ''))throw new Error('Choose valid start and end dates.');
  const date=new Date(`${value}T00:00:00Z`);
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value)throw new Error('Choose valid start and end dates.');
  return date;
}
function targetRange(input) {
  const period=input.period || 'month';
  if(period==='month') {
    const range=monthRange(input.month);const end=new Date(Date.parse(range.to)-1);
    const endDate=new Date(end.getTime()+330*60000).toISOString().slice(0,10);
    return {...range,period,month:input.month,startDate:`${input.month}-01`,endDate,key:input.month,label:input.month};
  }
  let start=validDate(input.from || input.date), end;
  if(period==='day')end=new Date(start);
  else if(period==='week'){start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(end.getUTCDate()+6);}
  else if(period==='custom')end=validDate(input.to);
  else throw new Error('Choose daily, weekly, monthly or custom dates.');
  if(end<start || (end-start)/86400000>365)throw new Error('Choose an ordered date range of up to one year.');
  const startDate=start.toISOString().slice(0,10),endDate=end.toISOString().slice(0,10);
  end.setUTCDate(end.getUTCDate()+1);
  return {period,startDate,endDate,from:`${startDate}T00:00:00+05:30`,to:`${end.toISOString().slice(0,10)}T00:00:00+05:30`,key:`${period}_${startDate}_${endDate}`,month:startDate.slice(0,7),label:period==='day'?startDate:`${startDate} to ${endDate}`};
}
module.exports={monthRange,progress,targetRange};
