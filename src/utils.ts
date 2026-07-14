import type { Period } from './types';

export const ALL_REWARD_OPTIONS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatPoints(value: number | string | null | undefined) {
  return Number(value || 0).toFixed(2);
}

export function formatCurrency(value: number | string | null | undefined) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatPhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value;
}

export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function dateInput(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function indiaIso(date: Date) {
  return `${dateInput(date)}T00:00:00+05:30`;
}

export function rangeForPeriod(period: Period, customFrom?: string, customTo?: string) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  if (period === 'custom') {
    if (!customFrom || !customTo) return null;
    const after = new Date(`${customTo}T00:00:00+05:30`);
    after.setDate(after.getDate() + 1);
    return { from: `${customFrom}T00:00:00+05:30`, to: indiaIso(after) };
  }
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  }
  if (period === 'month') start.setDate(1);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return { from: indiaIso(start), to: indiaIso(end) };
}

export function qrPayload(customer: { id: string; name: string; phone: string }) {
  return JSON.stringify({ id: customer.id, name: customer.name, phone: customer.phone });
}
