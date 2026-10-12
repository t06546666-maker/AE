import { rangeForChartPeriod } from './utils';
export function adminReportRange(period:string,month:string,from:string,to:string){
 if(period==='selected-month')return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)?rangeForChartPeriod('month',undefined,undefined,month):null;
 if(period==='date'||period==='custom'){
  const endText=period==='date'?from:to;
  const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
  if(!valid(from)||!valid(endText)||endText<from)return null;
  const end=new Date(`${endText}T00:00:00Z`);end.setUTCDate(end.getUTCDate()+1);
  return {from:`${from}T00:00:00+05:30`,to:`${end.toISOString().slice(0,10)}T00:00:00+05:30`};
 }
 return ['today','week','month'].includes(period)?rangeForChartPeriod(period as 'today'|'week'|'month'):null;
}
