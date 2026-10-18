// Development-only visual fixture, not an application route or a production entry.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MerchantOverview } from '../src/pages/MerchantOverview';
import { More } from '../src/pages/More';
import { MerchantProfile } from '../src/pages/MerchantProfile';
import { MerchantShopCheckout } from '../src/components/ShopCheckout';
import { Layout } from '../src/components/Layout';
import i18n from '../src/i18n';
import '../src/styles.css';
import '../src/malayalam-layout.css';

if (!import.meta.env.DEV) throw new Error('Preview is development-only');
if (window.parent !== window) window.setInterval(() => {
  window.parent.postMessage({ type: 'merchant-qa', width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, theme: document.documentElement.dataset.theme, english: document.body.innerText.match(/[A-Za-z][A-Za-z ]{2,}/g) || [], overflow: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0,8).map(el => ({tag:el.tagName,css:el.className,text:el.textContent?.slice(0,60)})) }, window.location.origin);
}, 1000);
const user = { id: 'sample', merchant_id: 'sample-merchant', role: 'merchant' as const, full_name: 'Sample Store', email: 'sample@example.invalid' };
const previewParams = new URLSearchParams(window.location.search);
void i18n.changeLanguage(previewParams.get('lang') === 'en' ? 'en' : 'ml');
const shop = { name: 'Sample Store', merchant_code: 'DEMO-001', email: user.email, phone: '0000000000', address: 'Sample address', opening_time: '09:00', closing_time: '21:00' };
const names = ['Ramesh K', 'Priya S', 'Abdul Rahman', 'Sneha N', 'Vinoth M', 'New Customer'];
const customers = names.map((name, i) => ({ id: `sample-${i}`, name, phone: '', email: '', registeredAt: '2026-08-01T00:00:00Z' }));
const orders = Array.from({ length: 38 }, (_, i) => ({ id: `purchase-${i}`, orderNo: `TEST-${i + 1}`, cid: customers[i % 5].id, customer: names[i % 5], phone: '', amount: (i % 5 + 1) * 230, timestamp: i < 3 ? `2026-08-0${i + 1}T12:00:00Z` : `2026-09-${String(1 + i % 19).padStart(2, '0')}T${String(3 + i % 15).padStart(2, '0')}:00:00Z` }));
// This isolated preview never sends requests, writes records, or authenticates.
window.fetch = async input => {
  const url = String(input);
  const payload = url.includes('/api/languages/') ? { locale: 'none' }
    : url.includes('/api/daily-greetings') ? { messages: ['Give your customers another reason to come back.'], rotationStart: '2026-01-01' }
    : url.includes('/point-balance') ? { balance: 2000 }
    : url.includes('/api/merchant/loyal-customers') ? { customers: [] }
    : url.includes('/api/merchant-profile') || url.includes('/api/merchants/') ? { data: shop }
    : url.includes('/api/merchant/shop-requests') ? { requests: [] }
    : url.includes('/api/merchant/shop-qr') ? { payload: 'DEMO-ONLY-NOT-A-VALID-SHOP' }
    : url.includes('/api/merchant/sales-target') ? { month: '2026-09', label: '2026-09', target: null, sales: 27600, remaining: null, percent: 0, achieved: false, to: '2026-10-01' }
    : url.includes('/api/dashboard') ? { summary: { totalOrders:38,totalRevenue:27600,rewardPointsIssued:200,totalCustomers:6 },intervals:[],retention:{lifetimeCustomers:6,selectedVisits:38,todayVisits:0,weekVisits:0,monthVisits:38} }
    : url.includes('/api/orders') ? { orders, pagination: { totalPages: 1 } }
    : url.includes('/api/customers') ? { customers, pagination: { totalPages: 1 } }
    : url.includes('/api/notifications') ? { notifications: [], unreadCount: 0 }
    : { supabase: false, resend: false, whatsapp: false };
  return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
client.setQueryData(['merchant-overview', user.id, user.merchant_id], { orders, customers });
client.setQueryData(['status'], { supabase: false, resend: false, whatsapp: false });
client.setQueryData(['notifications'], { notifications: [], unreadCount: 0 });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[previewParams.get('screen') || '/dashboard?month=2026-09']}><div style={{ background: '#fff3c4', color: '#614800', padding: 6, textAlign: 'center', fontSize: 11 }}>LOCAL PREVIEW • SAMPLE DATA ONLY</div><Layout user={user} onLogout={() => {}}><Routes><Route path="/dashboard" element={<MerchantOverview user={user}/>}/><Route path="/customers" element={<MerchantOverview user={user}/>}/><Route path="/more" element={<More user={user} onLogout={() => {}}/>}/><Route path="/merchant-profile" element={<MerchantProfile user={user}/>}/><Route path="/shop-checkout" element={<MerchantShopCheckout/>}/></Routes></Layout></MemoryRouter></QueryClientProvider>);
