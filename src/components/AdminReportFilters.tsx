import { useState } from 'react';
import { rangeForChartPeriod, dateInput } from '../utils';
import { uiText } from '../uiText';
import { adminReportRange } from '../adminReportRange';
export function useAdminReportFilters(){
 const today=dateInput();const [period,setPeriod]=useState('today'),[month,setMonth]=useState(today.slice(0,7)),[from,setFrom]=useState(today),[to,setTo]=useState(today),[area,setArea]=useState('');
 const range=adminReportRange(period,month,from,to);
 const valid=Boolean(range&&Number.isFinite(Date.parse(range.from))&&Number.isFinite(Date.parse(range.to))&&Date.parse(range.to)>Date.parse(range.from)&&Date.parse(range.to)-Date.parse(range.from)<=366*86400000);
 return {period,setPeriod,month,setMonth,from,setFrom,to,setTo,area,setArea,range,valid};
}
export function AdminReportFilters({state,areas=[]}:{state:ReturnType<typeof useAdminReportFilters>;areas?:string[]}){
 return <section className="admin-card admin-report-filters"><label>{uiText('Reporting period')}<select value={state.period} onChange={e=>state.setPeriod(e.target.value)}>{[['today','Today'],['week','This Week'],['month','This Month'],['selected-month','Choose month'],['date','Choose Date'],['custom','Custom date range']].map(([key,label])=><option key={key} value={key}>{uiText(label)}</option>)}</select></label>{state.period==='selected-month'&&<label>{uiText('Reporting month')}<input type="month" value={state.month} onChange={e=>setIfValue(e.target.value,state.setMonth)}/></label>}{['date','custom'].includes(state.period)&&<label>{uiText(state.period==='date'?'Choose Date':'From date')}<input type="date" value={state.from} onChange={e=>state.setFrom(e.target.value)}/></label>}{state.period==='custom'&&<label>{uiText('To date')}<input type="date" value={state.to} onChange={e=>state.setTo(e.target.value)}/></label>}<label>{uiText('Merchant area / route')}<select value={state.area} onChange={e=>state.setArea(e.target.value)}><option value="">{uiText('All areas')}</option>{areas.map(area=><option key={area} value={area}>{area}</option>)}</select></label>{!state.valid&&<p role="alert">{uiText('Choose a valid range of up to one year.')}</p>}</section>;
}
function setIfValue(value:string,set:(value:string)=>void){if(value)set(value);}
