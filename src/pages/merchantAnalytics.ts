import type { Customer, Order } from '../types';

const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export const indiaDate = (value: string | Date) => dateFormatter.format(new Date(value));
export const previousMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1)).toISOString().slice(0, 7);
export const monthDays = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
export function changePercent(current: number, previous: number) {
  return previous === 0 ? null : Math.round((current - previous) / previous * 100);
}

export function buildMerchantAnalytics(orders: Order[], registered: Customer[], month: string, now = new Date()) {
  const today = indiaDate(now);
  const days = month === today.slice(0, 7) ? Number(today.slice(8)) : monthDays(month);
  const validOrders = orders.filter(o => Number.isFinite(Date.parse(o.timestamp)) && indiaDate(o.timestamp) <= today);
  const groups = new Map<string, Order[]>();
  for (const o of validOrders) {
    const key = o.cid || o.phone || o.id;
    const group = groups.get(key) || [];
    group.push(o);
    groups.set(key, group);
  }
  const records = new Map(registered.map(c => [c.id, c]));
  const ids = new Set([...records.keys(), ...groups.keys()]);
  const customers = [...ids].map(id => {
    const visits = [...(groups.get(id) || [])].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const record = records.get(id);
    return {
      id, name: record?.name || visits[0]?.customer || 'Customer', phone: record?.phone || visits[0]?.phone || '',
      email: record?.email || visits[0]?.email || '', joined: record?.registeredAt || visits.at(-1)?.timestamp || '',
      visits, spend: visits.reduce((sum, o) => sum + o.amount, 0), first: visits.at(-1)?.timestamp,
    };
  }).sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));

  function period(periodMonth: string, limit: number) {
    const end = `${periodMonth}-${String(Math.min(limit, monthDays(periodMonth))).padStart(2, '0')}`;
    const current = validOrders.filter(o => { const date = indiaDate(o.timestamp); return date.startsWith(periodMonth) && date <= end; });
    const activeIds = new Set(current.map(o => o.cid || o.phone || o.id));
    const active = customers.filter(c => activeIds.has(c.id));
    // New and returning are disjoint cohorts, so they always add up to total.
    const fresh = active.filter(c => c.first && indiaDate(c.first).startsWith(periodMonth));
    const returning = active.filter(c => c.first && indiaDate(c.first) < `${periodMonth}-01`);
    const countThroughEnd = (c: typeof customers[number]) => c.visits.filter(o => indiaDate(o.timestamp) <= end).length;
    const repeat = active.filter(c => countThroughEnd(c) >= 2);
    const loyal = active.filter(c => countThroughEnd(c) >= 3);
    const sales = current.reduce((sum, o) => sum + o.amount, 0);
    return { orders: current, active, fresh, returning, repeat, loyal, sales, average: current.length ? sales / current.length : 0 };
  }
  const current = period(month, days);
  const priorMonth = previousMonth(month);
  const previous = period(priorMonth, month === today.slice(0, 7) ? days : monthDays(priorMonth));
  const freshIds = new Set(current.fresh.map(c => c.id));
  const seen = new Set<string>();
  const daily = new Map<string, Order[]>();
  current.orders.forEach(o => { const day = indiaDate(o.timestamp); daily.set(day, [...(daily.get(day) || []), o]); });
  let newCount = 0;
  const growth = Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    for (const o of daily.get(date) || []) {
      const id = o.cid || o.phone || o.id;
      if (!seen.has(id)) { seen.add(id); if (freshIds.has(id)) newCount++; }
    }
    return { day: i + 1, total: seen.size, fresh: newCount, returning: seen.size - newCount };
  });
  const heat = Array.from({ length: 7 }, () => Array<number>(8).fill(0));
  current.orders.forEach(o => {
    const d = new Date(Date.parse(o.timestamp) + 330 * 60000);
    heat[(d.getUTCDay() + 6) % 7][Math.floor(d.getUTCHours() / 3)]++;
  });
  const busiest = heat.map(row => row.reduce((sum, n) => sum + n, 0));
  const busiestDay = current.orders.length ? busiest.indexOf(Math.max(...busiest)) : -1;
  const newSpend = current.orders.filter(o => freshIds.has(o.cid || o.phone || o.id)).reduce((sum, o) => sum + o.amount, 0);
  return { customers, current, previous, priorMonth, growth, heat, busiestDay, days, newSpend, returningSpend: current.sales - newSpend,
    comparisonLabel: month === today.slice(0, 7) ? `vs first ${Math.min(days, monthDays(priorMonth))} days of last month` : 'vs previous month' };
}
export type MerchantAnalytics = ReturnType<typeof buildMerchantAnalytics>;
export type MerchantCustomer = MerchantAnalytics['customers'][number];
