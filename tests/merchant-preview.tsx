// Development-only visual fixture, not an application route or a production entry.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MerchantOverview } from '../src/pages/MerchantOverview';
import { Layout } from '../src/components/Layout';
import '../src/i18n';
import '../src/styles.css';

if (!import.meta.env.DEV) throw new Error('Preview is development-only');
const user = { id: 'sample', merchant_id: 'sample-merchant', role: 'merchant' as const, full_name: 'Sample Store', email: 'sample@example.invalid' };
const names = ['Ramesh K', 'Priya S', 'Abdul Rahman', 'Sneha N', 'Vinoth M', 'New Customer'];
const customers = names.map((name, i) => ({ id: `sample-${i}`, name, phone: '', email: '', registeredAt: '2026-08-01T00:00:00Z' }));
const orders = Array.from({ length: 38 }, (_, i) => ({ id: `purchase-${i}`, orderNo: `TEST-${i + 1}`, cid: customers[i % 5].id, customer: names[i % 5], phone: '', amount: (i % 5 + 1) * 230, timestamp: i < 3 ? `2026-08-0${i + 1}T12:00:00Z` : `2026-09-${String(1 + i % 19).padStart(2, '0')}T${String(3 + i % 15).padStart(2, '0')}:00:00Z` }));
// This isolated preview never sends requests, writes records, or authenticates.
window.fetch = async input => {
  const url = String(input);
  const payload = url.includes('/api/orders') ? { orders, pagination: { totalPages: 1 } } : url.includes('/api/customers') ? { customers, pagination: { totalPages: 1 } } : url.includes('/api/notifications') ? { notifications: [], unreadCount: 0 } : { supabase: false, resend: false, whatsapp: false };
  return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
client.setQueryData(['merchant-overview', user.id, user.merchant_id], { orders, customers });
client.setQueryData(['status'], { supabase: false, resend: false, whatsapp: false });
client.setQueryData(['notifications'], { notifications: [], unreadCount: 0 });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard?month=2026-09']}><div style={{ background: '#fff3c4', color: '#614800', padding: 6, textAlign: 'center', fontSize: 11 }}>LOCAL PREVIEW • SAMPLE DATA ONLY</div><Layout user={user} onLogout={() => {}}><MerchantOverview user={user} /></Layout></MemoryRouter></QueryClientProvider>);
