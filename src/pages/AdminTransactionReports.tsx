import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { apiFetch, downloadExport, queryString } from '../api';
import { uiText } from '../uiText';
import type { Pagination } from '../types';
import { formatCurrency, formatDate, formatTime, formatPoints } from '../utils';
import { AdminReportFilters, useAdminReportFilters } from '../components/AdminReportFilters';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import '../admin-dashboard.css';
import './admin-transaction-reports.css';
type RecordRow = { id:string; reference:string; timestamp:string; customer:string; customerCode:string; merchant:string; merchantCode:string; area:string; amount:number|null; points:number; discount:number; source:string };
type Report = { records:RecordRow[]; pagination:Pagination; summary:{ count:number; billAmount:number; discountAmount:number; points:number; netAmount:number|null; missingAmounts:number } };
export function AdminTransactionReports() {
  const filters = useAdminReportFilters();
  const [kind,setKind] = useState('redemptions'), [page,setPage] = useState(1), [search,setSearch] = useState('');
  const [exporting,setExporting] = useState(false), [exportError,setExportError] = useState('');
  const term = useDeferredValue(search.trim());
  const rangeKey = filters.range?.from + ':' + filters.range?.to + ':' + filters.area + ':' + kind + ':' + term;
  useEffect(() => { setPage(1); setExportError(''); }, [rangeKey]);
  const areas = useQuery({queryKey:['admin-report-areas'],queryFn:()=>apiFetch<{areas:string[]}>('/api/admin/report-areas')});
  const params = { ...filters.range, area:filters.area, kind, search:term };
  const report = useQuery({queryKey:['admin-transaction-report',rangeKey,page],enabled:filters.valid,
    queryFn:({signal})=>apiFetch<Report>('/api/admin/transaction-report?' + queryString({...params,page}),{signal})});
  const redeemed = kind === 'redemptions';
  async function exportReport() { setExporting(true); setExportError(''); try { await downloadExport('/api/admin/transaction-report?' + queryString({...params,format:'xlsx'})); } catch(error) { setExportError(error instanceof Error ? error.message : 'Export failed'); } finally { setExporting(false); } }
  return <div className="admin-dashboard admin-transaction-reports">
    <PageHeader title={uiText('Transaction reports')} subtitle={uiText('Review purchases, redeemed points and discounts across your shops.')} actions={<button className="button secondary" disabled={!filters.valid || exporting || report.isPending || report.isError} onClick={()=>void exportReport()}><Download size={16}/>{uiText(exporting ? 'Exporting…' : 'Download Excel')}</button>}/>
    <div className="report-tabs" role="group" aria-label={uiText('Report type')}>{[['redemptions','Redemptions'],['purchases','Purchases']].map(([value,label])=><button type="button" key={value} className={'button ' + (kind===value?'primary':'secondary')} aria-pressed={kind===value} onClick={()=>setKind(value)}>{uiText(label)}</button>)}</div>
    <AdminReportFilters state={filters} areas={areas.data?.areas || []}/>
    {areas.isError && <p role="alert">{uiText('Area list unavailable. Refresh to retry.')}</p>}
    <label className="search-field report-search"><Search size={17}/><input value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} placeholder={uiText('Search customer, shop or reference')} aria-label={uiText('Search customer, shop or reference')}/></label>
    {exportError && <p role="alert">{exportError}</p>}
    {!filters.valid ? null : report.isPending ? <LoadingState/> : report.isError ? <ErrorState error={report.error} retry={()=>void report.refetch()}/> : <>
      <div className="report-summary">{[[redeemed?'Redemptions':'Purchases',String(report.data!.summary.count)],[redeemed?'Points redeemed':'Points issued',formatPoints(report.data!.summary.points)],['Bill amount',formatCurrency(report.data!.summary.billAmount)],['Discount given',formatCurrency(report.data!.summary.discountAmount)]].map(([label,value])=><article className="admin-card" key={label}><span>{uiText(label)}</span><strong>{value}</strong></article>)}</div>
      <p className="admin-data-note">{uiText('Totals cover all matching records, not only this page. Net bill does not verify payment receipt.')}</p>
      <section className="table-panel"><div className="table-scroll"><table><thead><tr>{['Customer','Shop','Bill amount',redeemed?'Points redeemed':'Points issued','Discount given','Net bill','Date','Details'].map(label=><th key={label}>{uiText(label)}</th>)}</tr></thead><tbody>{report.data!.records.map(row=><tr key={row.id}>
        <td><strong>{row.customer || uiText('Unavailable')}</strong><small className="report-subtext">{row.customerCode}</small></td><td><strong>{row.merchant || uiText('Unavailable')}</strong><small className="report-subtext">{row.merchantCode}</small></td><td>{row.amount == null ? '—' : formatCurrency(row.amount)}</td><td>{formatPoints(row.points)}</td><td>{formatCurrency(row.discount)}</td><td>{row.amount == null ? '—' : formatCurrency(Math.round((row.amount-row.discount)*100)/100)}</td><td>{formatDate(row.timestamp)}<small className="report-subtext">{formatTime(row.timestamp)}</small></td>
        <td><details><summary>{uiText('View details')}</summary><dl><dt>{uiText('Reference')}</dt><dd>{row.reference}</dd><dt>{uiText('Record ID')}</dt><dd>{row.id}</dd><dt>{uiText('Merchant area / route')}</dt><dd>{row.area || '—'}</dd>{row.source && <><dt>{uiText('Source')}</dt><dd>{row.source}</dd></>}</dl></details></td>
      </tr>)}</tbody></table></div>{!report.data!.records.length && <EmptyState>{uiText('No matching transactions for this period.')}</EmptyState>}<PaginationBar pagination={report.data!.pagination} onPage={setPage}/></section>
    </>}
  </div>;
}
