import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  CalendarClock, 
  Car, 
  Search, 
  Plus, 
  Download, 
  Upload, 
  MessageCircle, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Clock, 
  Sparkles,
  ExternalLink,
  Phone,
  FileSpreadsheet,
  ShieldAlert,
  Calendar,
  Languages,
  Check,
  Filter,
  RefreshCw
} from 'lucide-react';
import { PageHeader } from '../components/Common';
import { uiText } from '../uiText';
import type { UserProfile } from '../types';
import './merchant-expiry-manager.css';

export interface ExpiryRecord {
  id: string;
  customerName: string;
  phone: string;
  vehicleNumber: string;
  vehicleType: string;
  fee: number;
  testDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  notes?: string;
  lastRemindedAt?: string;
}

const DEFAULT_SAMPLE_RECORDS: ExpiryRecord[] = [
  {
    id: 'exp-1',
    customerName: 'Mohammed Rasheed',
    phone: '9847123456',
    vehicleNumber: 'KL-09-AL-4589',
    vehicleType: '2-Wheeler Petrol',
    fee: 100,
    testDate: '2026-05-12',
    expiryDate: '2026-11-12', // Due in ~5 days
    notes: 'Honda Activa 6G Grey',
  },
  {
    id: 'exp-2',
    customerName: 'Anoop Kumar',
    phone: '9447654321',
    vehicleNumber: 'KL-53-E-1204',
    vehicleType: 'Diesel LMV (Car)',
    fee: 150,
    testDate: '2026-05-25',
    expiryDate: '2026-11-25', // Expiring this month
    notes: 'Swift Dzire Diesel White',
  },
  {
    id: 'exp-3',
    customerName: 'Faisal Rahman',
    phone: '9745112233',
    vehicleNumber: 'KL-09-BW-8890',
    vehicleType: '4-Wheeler Petrol',
    fee: 120,
    testDate: '2026-06-18',
    expiryDate: '2026-12-18', // Expiring next month
    notes: 'Hyundai i20 Sportz',
  },
  {
    id: 'exp-4',
    customerName: 'Suresh Babu',
    phone: '9895001122',
    vehicleNumber: 'KL-09-Q-3312',
    vehicleType: 'Commercial HMV',
    fee: 200,
    testDate: '2026-05-01',
    expiryDate: '2026-11-01', // Expired
    notes: 'Eicher 11.10 Tipper',
  },
  {
    id: 'exp-5',
    customerName: 'Priya Nair',
    phone: '9496334455',
    vehicleNumber: 'KL-10-AZ-7721',
    vehicleType: '2-Wheeler Petrol',
    fee: 100,
    testDate: '2026-11-02',
    expiryDate: '2027-05-02', // Valid next year
    notes: 'TVS Jupiter 125 Blue',
  },
  {
    id: 'exp-6',
    customerName: 'Abdul Salam',
    phone: '9567889900',
    vehicleNumber: 'KL-09-CC-5100',
    vehicleType: 'Diesel LMV (Van)',
    fee: 150,
    testDate: '2026-05-20',
    expiryDate: '2026-11-20', // Expiring this month
    notes: 'Innova Crysta 2.4 VX',
  }
];

export function MerchantExpiryManager({ user }: { user: UserProfile }) {
  const [records, setRecords] = useState<ExpiryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ae_merchant_expiry_records');
      return saved ? JSON.parse(saved) : DEFAULT_SAMPLE_RECORDS;
    } catch {
      return DEFAULT_SAMPLE_RECORDS;
    }
  });

  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  // Modals & CSV File Input
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [reminderModalRecord, setReminderModalRecord] = useState<ExpiryRecord | null>(null);
  const [reminderLang, setReminderLang] = useState<'ml' | 'en'>('ml');
  const [toastMessage, setToastMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Record Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newType, setNewType] = useState('2-Wheeler Petrol');
  const [newFee, setNewFee] = useState(100);
  const [newTestDate, setNewTestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newExpiryDate, setNewExpiryDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('ae_merchant_expiry_records', JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save expiry records to localStorage', e);
    }
  }, [records]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Helper to calculate status
  const getRecordStatus = (expiryDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    exp.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { key: 'expired', label: `Expired (${Math.abs(diffDays)}d ago)`, pillClass: 'expired' };
    }
    if (diffDays <= 7) {
      return { key: 'urgent', label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}!`, pillClass: 'urgent' };
    }
    if (diffDays <= 30) {
      return { key: 'expiring', label: `Due in ${diffDays} days`, pillClass: 'expiring' };
    }
    return { key: 'valid', label: 'Valid / Active', pillClass: 'valid' };
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || 
        r.customerName.toLowerCase().includes(q) || 
        r.vehicleNumber.toLowerCase().includes(q) || 
        r.phone.includes(q);

      if (!matchSearch) return false;

      if (serviceFilter !== 'all' && r.vehicleType !== serviceFilter) {
        return false;
      }

      if (monthFilter === 'all') return true;
      if (monthFilter === 'this_month') {
        const curMonth = new Date().toISOString().slice(0, 7);
        return r.expiryDate.startsWith(curMonth);
      }
      if (monthFilter === 'next_month') {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const nextMonth = d.toISOString().slice(0, 7);
        return r.expiryDate.startsWith(nextMonth);
      }
      if (monthFilter === 'expired') {
        const status = getRecordStatus(r.expiryDate);
        return status.key === 'expired';
      }

      return r.expiryDate.startsWith(monthFilter);
    });
  }, [records, search, monthFilter, serviceFilter]);

  // Stats Counters
  const stats = useMemo(() => {
    let expiringThisMonth = 0;
    let urgentDue = 0;
    let expired = 0;
    const curMonth = new Date().toISOString().slice(0, 7);

    records.forEach(r => {
      const st = getRecordStatus(r.expiryDate);
      if (st.key === 'expired') expired++;
      if (st.key === 'urgent') urgentDue++;
      if (r.expiryDate.startsWith(curMonth)) expiringThisMonth++;
    });

    return {
      total: records.length,
      expiringThisMonth,
      urgentDue,
      expired,
    };
  }, [records]);

  // Excel / CSV Export
  const handleExportCSV = () => {
    const headers = ['Customer Name', 'Phone Number', 'Vehicle Number', 'Service Type', 'Fee (Rs)', 'Test Date', 'Expiry Date', 'Status', 'Notes'];
    const rows = filteredRecords.map(r => [
      `"${r.customerName}"`,
      `"${r.phone}"`,
      `"${r.vehicleNumber}"`,
      `"${r.vehicleType}"`,
      r.fee,
      r.testDate,
      r.expiryDate,
      `"${getRecordStatus(r.expiryDate).label}"`,
      `"${r.notes || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AE_Vehicle_Pollution_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported customer register to Excel/CSV!');
  };

  // CSV File Import Handler
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          showToast('CSV file is empty or missing data rows.');
          return;
        }

        const imported: ExpiryRecord[] = [];
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(s => s.replace(/^["']|["']$/g, '').trim());
          if (cols.length >= 3) {
            const customerName = cols[0] || 'Customer';
            const phone = cols[1]?.replace(/\D/g, '') || '';
            const vehicleNumber = cols[2]?.toUpperCase() || '';
            const vehicleType = cols[3] || '2-Wheeler Petrol';
            const fee = Number(cols[4]) || 100;
            const testDate = cols[5] || new Date().toISOString().slice(0, 10);
            const expiryDate = cols[6] || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
            const notes = cols[8] || cols[7] || '';

            if (vehicleNumber) {
              imported.push({
                id: `imp-${Date.now()}-${i}`,
                customerName,
                phone,
                vehicleNumber,
                vehicleType,
                fee,
                testDate,
                expiryDate,
                notes,
              });
            }
          }
        }

        if (imported.length > 0) {
          setRecords(prev => [...imported, ...prev]);
          showToast(`Successfully imported ${imported.length} vehicle records from CSV!`);
          setImportModalOpen(false);
        } else {
          showToast('No valid vehicle records found in CSV file.');
        }
      } catch (err) {
        showToast('Error parsing CSV file. Please check format.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // Add Record Handler
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newVehicle.trim() || !newPhone.trim()) {
      showToast('Please fill required fields (Name, Phone, Vehicle Number)');
      return;
    }

    const cleanPhone = newPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('Please enter a valid 10-digit WhatsApp number');
      return;
    }

    const newRec: ExpiryRecord = {
      id: `exp-${Date.now()}`,
      customerName: newName.trim(),
      phone: cleanPhone.slice(-10),
      vehicleNumber: newVehicle.trim().toUpperCase(),
      vehicleType: newType,
      fee: Number(newFee) || 100,
      testDate: newTestDate,
      expiryDate: newExpiryDate,
      notes: newNotes.trim() || undefined,
    };

    setRecords(prev => [newRec, ...prev]);
    setAddModalOpen(false);
    // Reset
    setNewName('');
    setNewPhone('');
    setNewVehicle('');
    setNewNotes('');
    showToast(`Added vehicle record for ${newRec.vehicleNumber}!`);
  };

  // WhatsApp Reminder Text Generator (Matching the user's template view)
  const getWhatsAppReminderText = (rec: ExpiryRecord, lang: 'ml' | 'en' = 'ml') => {
    const shopName = user.full_name || 'AE Pollution Testing & Fitness Center';
    const shopPhone = user.phone || '9847000000';

    if (lang === 'en') {
      return `pollution_reminder\n\nDear ${rec.customerName},\n\nYour vehicle (${rec.vehicleNumber}) Pollution Under Control (PUC) Certificate is expiring on ${rec.expiryDate}! ⚠️\n\n📋 Vehicle Details:\n• Vehicle: ${rec.vehicleNumber}\n• Model: ${rec.notes || rec.vehicleType}\n• Govt Fee: ₹${rec.fee} 🚗\n\nAvoid heavy MVD / Police traffic fines of up to ₹2,000 by renewing your certificate today! 🛡️\n\n📍 Center: ${shopName}\n📞 Contact: ${shopPhone}\n\n🗓️ Valid Until: ${rec.expiryDate}\nAE — Where customers meet businesses and beyond.\n📲 Instagram: @ae.kerala\n\nTerms & conditions apply.`;
    }

    return `pollution_reminder\n\nപ്രിയപ്പെട്ട ${rec.customerName},\n\nനിങ്ങളുടെ വാഹനം (${rec.vehicleNumber}) മലിനീകരണ നിയന്ത്രണ സർട്ടിഫിക്കറ്റ് (PUC) കാലാവധി ${rec.expiryDate}-ൽ അവസാനിക്കുകയാണ്! ⚠️\n\n📋 വാഹന വിവരങ്ങൾ:\n• വാഹനം: ${rec.vehicleNumber}\n• മോഡൽ: ${rec.notes || rec.vehicleType}\n• സർക്കാർ ഫീസ്: ₹${rec.fee} 🚗\n\nപോലീസ് / MVD പിഴ (₹2,000 വരെ) ഒഴിവാക്കാൻ ഉടൻ ഞങ്ങളുടെ കേന്ദ്രത്തിൽ സന്ദർശിച്ച് പുതുക്കാം! 🛡️\n\n📍 കേന്ദ്രം: ${shopName}\n📞 ബന്ധപ്പെടുക: ${shopPhone}\n\n🗓️ കാലാവധി: ${rec.expiryDate}\nAE — Where customers meet businesses and beyond.\n📲 Instagram: @ae.kerala\n\nനിബന്ധനകൾ ബാധകം.`;
  };

  const handleSendReminder = (rec: ExpiryRecord) => {
    setRecords(prev => prev.map(item => item.id === rec.id ? { ...item, lastRemindedAt: new Date().toISOString() } : item));
    const msg = getWhatsAppReminderText(rec, reminderLang);
    const waUrl = `https://wa.me/91${rec.phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    setReminderModalRecord(null);
    showToast(`WhatsApp reminder opened for ${rec.customerName}!`);
  };

  return (
    <div className="expiry-manager-wrapper">
      {/* Top Header with Actions */}
      <PageHeader 
        title={uiText("Vehicle Pollution & Expiry Manager")} 
        subtitle="Manage customer vehicle records, track monthly expiry, and send instant WhatsApp renewal reminders."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="button secondary" 
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Import customer register from CSV/Excel"
            >
              <Upload size={16} />
              <span>{uiText("Import Excel / CSV")}</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".csv" 
              style={{ display: 'none' }} 
              onChange={handleImportCSV} 
            />

            <button 
              type="button" 
              className="button secondary" 
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Download customer records as Excel/CSV"
            >
              <Download size={16} />
              <span>{uiText("Export Excel")}</span>
            </button>

            <button 
              type="button" 
              className="button primary" 
              onClick={() => setAddModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>{uiText("Add Vehicle Entry")}</span>
            </button>
          </div>
        }
      />

      {/* Kerala Government MVD Statutory Tariff Notice Banner */}
      <div className="expiry-category-notice">
        <div className="expiry-category-notice-content">
          <div className="expiry-gov-badge">
            <span className="gov-seal">🏛️</span>
            <span>MVD Kerala Statutory Tariff Mode</span>
          </div>
          <div className="expiry-gov-text">
            <strong>Fixed Government Rates: 2-Wheeler ₹100 · 4-Wheeler Petrol ₹120 · Diesel LMV ₹150 · Commercial ₹200</strong>
            <p>
              {uiText("Statutory service charges cannot offer coin discount redemption. Instead, your automated WhatsApp renewal reminder system prevents customer police fines and boosts vehicle return rates to 95%+.")}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="expiry-stats-grid">
        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Total Vehicles</h4>
            <div className="stat-value">{stats.total}</div>
            <span className="stat-subtext">Registered vehicles</span>
          </div>
          <div className="expiry-stat-icon blue">
            <Car size={24} />
          </div>
        </div>

        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Expiring This Month</h4>
            <div className="stat-value" style={{ color: '#d97706' }}>{stats.expiringThisMonth}</div>
            <span className="stat-subtext">Needs WhatsApp reminder</span>
          </div>
          <div className="expiry-stat-icon amber">
            <CalendarClock size={24} />
          </div>
        </div>

        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Due Within 7 Days</h4>
            <div className="stat-value" style={{ color: '#ea580c' }}>{stats.urgentDue}</div>
            <span className="stat-subtext">High fine risk</span>
          </div>
          <div className="expiry-stat-icon orange">
            <Clock size={24} />
          </div>
        </div>

        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Overdue / Expired</h4>
            <div className="stat-value" style={{ color: '#dc2626' }}>{stats.expired}</div>
            <span className="stat-subtext">Requires immediate renewal</span>
          </div>
          <div className="expiry-stat-icon rose">
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="expiry-toolbar">
        <div className="expiry-toolbar-left">
          <div className="expiry-search-box">
            <Search size={16} color="#64748b" />
            <input 
              type="text" 
              placeholder={uiText("Search customer name, vehicle (KL-09...), or phone")} 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch('')} 
                style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Month Selector Dropdown */}
          <select 
            className="expiry-select-filter"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            aria-label="Filter by Month of Expiry"
          >
            <option value="all">📅 All Expiry Months</option>
            <option value="this_month">🔥 Expiring This Month</option>
            <option value="next_month">⏳ Expiring Next Month</option>
            <option value="expired">⚠️ Expired / Overdue</option>
          </select>

          {/* Service Type Filter */}
          <select 
            className="expiry-select-filter"
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            aria-label="Filter by Service"
          >
            <option value="all">🚗 All Vehicle Types</option>
            <option value="2-Wheeler Petrol">🛵 2-Wheeler Petrol (₹100)</option>
            <option value="4-Wheeler Petrol">🚗 4-Wheeler Petrol (₹120)</option>
            <option value="Diesel LMV (Car)">🚐 Diesel LMV Car/Van (₹150)</option>
            <option value="Commercial HMV">🚛 Commercial / Heavy (₹200)</option>
          </select>
        </div>

        <div className="expiry-toolbar-actions">
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            Showing <strong>{filteredRecords.length}</strong> of {records.length} records
          </span>
        </div>
      </div>

      {/* Main Records Table with Authentic Kerala Number Plates */}
      <div className="expiry-table-card">
        {filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
            <Car size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 800 }}>
              {uiText("No customer vehicle records found")}
            </h4>
            <p style={{ margin: '6px 0 16px', fontSize: '13px' }}>
              {uiText("Try adjusting your search or month filter, or add a new vehicle entry.")}
            </p>
            <button type="button" className="button primary" onClick={() => setAddModalOpen(true)}>
              <Plus size={16} /> {uiText("Add First Vehicle Entry")}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="expiry-table">
              <thead>
                <tr>
                  <th>Vehicle Number</th>
                  <th>Customer Details</th>
                  <th>Service Type & Fee</th>
                  <th>Test Date</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>WhatsApp Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(rec => {
                  const status = getRecordStatus(rec.expiryDate);
                  const isCommercial = rec.vehicleType.includes('Commercial') || rec.fee >= 200;
                  return (
                    <tr key={rec.id}>
                      {/* Kerala IND Number Plate */}
                      <td>
                        <div className={`kerala-plate-badge ${isCommercial ? 'commercial' : 'private'}`}>
                          <div className="plate-ind">
                            <span className="plate-ind-text">IND</span>
                          </div>
                          <span className="plate-num">{rec.vehicleNumber}</span>
                        </div>
                        {rec.notes && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                            {rec.notes}
                          </div>
                        )}
                      </td>

                      {/* Customer Details */}
                      <td>
                        <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>
                          {rec.customerName}
                        </strong>
                        <a 
                          href={`tel:+91${rec.phone}`}
                          style={{ fontSize: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', textDecoration: 'none', fontWeight: 600 }}
                        >
                          <Phone size={11} /> {rec.phone}
                        </a>
                      </td>

                      {/* Service Type & Statutory Fee */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>{rec.vehicleType}</div>
                        <span className="govt-tariff-pill">
                          ₹{rec.fee} Govt Fee
                        </span>
                      </td>

                      {/* Test Date */}
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                          {rec.testDate}
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                          {rec.expiryDate}
                        </strong>
                      </td>

                      {/* Status Pill */}
                      <td>
                        <span className={`expiry-status-pill ${status.pillClass}`}>
                          {status.key === 'expired' && <AlertTriangle size={12} />}
                          {status.key === 'urgent' && <Clock size={12} />}
                          {status.key === 'valid' && <CheckCircle2 size={12} />}
                          <span>{status.label}</span>
                        </span>
                      </td>

                      {/* WhatsApp Action Button */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={`wa-remind-btn ${rec.lastRemindedAt ? 'reminded' : ''}`}
                          onClick={() => {
                            setReminderModalRecord(rec);
                            setReminderLang('ml');
                          }}
                          title={rec.lastRemindedAt ? `Reminder already sent on ${rec.lastRemindedAt.slice(0, 10)}` : 'Open WhatsApp Reminder'}
                        >
                          <MessageCircle size={14} />
                          <span>{rec.lastRemindedAt ? uiText("Reminded ✓") : uiText("Remind")}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD NEW VEHICLE ENTRY MODAL */}
      {addModalOpen && (
        <div className="expiry-modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="expiry-modal-box" onClick={e => e.stopPropagation()}>
            <div className="expiry-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={20} color="#2563eb" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{uiText("Add Vehicle & Expiry Entry")}</h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Registers customer for automated renewal reminders</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setAddModalOpen(false)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRecord}>
              <div className="expiry-form-group">
                <label>{uiText("Customer Name *")}</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Mohammed Rasheed" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>

              <div className="expiry-form-group">
                <label>{uiText("WhatsApp Mobile Number *")}</label>
                <input 
                  type="tel" 
                  required 
                  placeholder="e.g. 9847123456 (10 digits)" 
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>

              <div className="expiry-form-group">
                <label>{uiText("Vehicle Registration Number *")}</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. KL-09-AL-4589" 
                  value={newVehicle}
                  onChange={e => setNewVehicle(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}
                />
              </div>

              <div className="expiry-form-group">
                <label>{uiText("Vehicle Service & Statutory Tariff")}</label>
                <select 
                  value={newType}
                  onChange={e => {
                    const val = e.target.value;
                    setNewType(val);
                    if (val.includes('2-Wheeler')) setNewFee(100);
                    else if (val.includes('4-Wheeler Petrol')) setNewFee(120);
                    else if (val.includes('Diesel')) setNewFee(150);
                    else if (val.includes('Commercial')) setNewFee(200);
                  }}
                >
                  <option value="2-Wheeler Petrol">🛵 2-Wheeler Petrol — ₹100</option>
                  <option value="4-Wheeler Petrol">🚗 4-Wheeler Petrol — ₹120</option>
                  <option value="Diesel LMV (Car)">🚐 Diesel LMV (Car / Van) — ₹150</option>
                  <option value="Commercial HMV">🚛 Commercial / Heavy Vehicle — ₹200</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="expiry-form-group">
                  <label>{uiText("Test Date")}</label>
                  <input 
                    type="date" 
                    value={newTestDate}
                    onChange={e => {
                      setNewTestDate(e.target.value);
                      const d = new Date(e.target.value);
                      d.setMonth(d.getMonth() + 6);
                      setNewExpiryDate(d.toISOString().split('T')[0]);
                    }}
                  />
                </div>

                <div className="expiry-form-group">
                  <label>{uiText("Expiry Date *")}</label>
                  <input 
                    type="date" 
                    required 
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Validity Chips */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Auto-calculate validity preset:</span>
                <div className="expiry-chip-group">
                  <button 
                    type="button" 
                    className="expiry-quick-chip"
                    onClick={() => {
                      const d = new Date(newTestDate || new Date());
                      d.setMonth(d.getMonth() + 6);
                      setNewExpiryDate(d.toISOString().split('T')[0]);
                    }}
                  >
                    ⚡ 6 Months (Standard PUC)
                  </button>
                  <button 
                    type="button" 
                    className="expiry-quick-chip"
                    onClick={() => {
                      const d = new Date(newTestDate || new Date());
                      d.setFullYear(d.getFullYear() + 1);
                      setNewExpiryDate(d.toISOString().split('T')[0]);
                    }}
                  >
                    🌟 1 Year (BS6 / New)
                  </button>
                </div>
              </div>

              <div className="expiry-form-group">
                <label>{uiText("Vehicle Model / Notes (Optional)")}</label>
                <input 
                  type="text" 
                  placeholder="e.g. Honda Activa 6G Grey" 
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                <button type="submit" className="button primary" style={{ flex: 1 }}>
                  {uiText("Save Vehicle Record")}
                </button>
                <button type="button" className="button secondary" onClick={() => setAddModalOpen(false)}>
                  {uiText("Cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP REMINDER MODAL (Matching exact real WhatsApp view from screenshot) */}
      {reminderModalRecord && (
        <div className="expiry-modal-overlay" onClick={() => setReminderModalRecord(null)}>
          <div className="expiry-modal-box wa-dialog-box" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="expiry-modal-header" style={{ paddingBottom: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={22} color="#25D366" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    {uiText("WhatsApp Renewal Reminder")}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {reminderModalRecord.customerName} · {reminderModalRecord.vehicleNumber}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Language Switcher */}
                <div className="wa-lang-switch">
                  <button
                    type="button"
                    className={`wa-lang-btn ${reminderLang === 'ml' ? 'active' : ''}`}
                    onClick={() => setReminderLang('ml')}
                  >
                    മലയാളം
                  </button>
                  <button
                    type="button"
                    className={`wa-lang-btn ${reminderLang === 'en' ? 'active' : ''}`}
                    onClick={() => setReminderLang('en')}
                  >
                    English
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={() => setReminderModalRecord(null)}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* REAL WHATSAPP BUBBLE PREVIEW ("OUR VIEW") */}
            <div className="wa-phone-container">
              {/* WhatsApp Green Topbar */}
              <div className="wa-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>←</span>
                  <div className="wa-avatar">AE</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Affiliate AE</span>
                      <span className="wa-verified-badge">✓</span>
                    </div>
                    <span style={{ fontSize: '10px', opacity: 0.85 }}>Official Business Account</span>
                  </div>
                </div>
                <span style={{ fontSize: '16px', opacity: 0.85 }}>⋮</span>
              </div>

              {/* Chat Wallpaper Area */}
              <div className="wa-wallpaper">
                <div className="wa-today-pill">Today</div>

                {/* Incoming Message Bubble matching user's screenshot */}
                <div className="wa-chat-bubble">
                  {/* Header: pollution_reminder */}
                  <div className="wa-bubble-title">
                    pollution_reminder
                  </div>

                  {/* Body with Markdown Formatting */}
                  <div className="wa-bubble-content">
                    {reminderLang === 'ml' ? (
                      <>
                        <p style={{ margin: '0 0 8px 0' }}>പ്രിയപ്പെട്ട {reminderModalRecord.customerName},</p>
                        <p style={{ margin: '0 0 8px 0' }}>
                          നിങ്ങളുടെ വാഹനം ({reminderModalRecord.vehicleNumber}) മലിനീകരണ നിയന്ത്രണ സർട്ടിഫിക്കറ്റ് (PUC) കാലാവധി <strong>{reminderModalRecord.expiryDate}</strong>-ൽ അവസാനിക്കുകയാണ്! ⚠️
                        </p>
                        <p style={{ margin: '0 0 4px 0', fontWeight: 700 }}>📋 വാഹന വിവരങ്ങൾ:</p>
                        <p style={{ margin: '0 0 8px 0', paddingLeft: '4px' }}>
                          • വാഹനം: <strong>{reminderModalRecord.vehicleNumber}</strong><br />
                          • മോഡൽ: {reminderModalRecord.notes || reminderModalRecord.vehicleType}<br />
                          • സർക്കാർ ഫീസ്: ₹{reminderModalRecord.fee} 🚗
                        </p>
                        <p style={{ margin: '0 0 8px 0' }}>
                          പോലീസ് / MVD പിഴ (₹2,000 വരെ) ഒഴിവാക്കാൻ ഉടൻ ഞങ്ങളുടെ കേന്ദ്രത്തിൽ സന്ദർശിച്ച് പുതുക്കാം! 🛡️
                        </p>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#166534', background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px' }}>
                          📍 കേന്ദ്രം: {user.full_name || 'AE Pollution Testing & Fitness Center'}<br />
                          📞 ബന്ധപ്പെടുക: {user.phone || '9847000000'}
                        </p>
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', fontSize: '11px', color: '#475569' }}>
                          <div>🗓️ കാലാവധി: {reminderModalRecord.expiryDate}</div>
                          <div>AE — Where customers meet businesses and beyond.</div>
                          <div style={{ color: '#2563eb', fontWeight: 700 }}>📲 Instagram: @ae.kerala</div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                          നിബന്ധനകൾ ബാധകം.
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 8px 0' }}>Dear {reminderModalRecord.customerName},</p>
                        <p style={{ margin: '0 0 8px 0' }}>
                          Your vehicle ({reminderModalRecord.vehicleNumber}) Pollution Under Control (PUC) Certificate is expiring on <strong>{reminderModalRecord.expiryDate}</strong>! ⚠️
                        </p>
                        <p style={{ margin: '0 0 4px 0', fontWeight: 700 }}>📋 Vehicle Details:</p>
                        <p style={{ margin: '0 0 8px 0', paddingLeft: '4px' }}>
                          • Vehicle: <strong>{reminderModalRecord.vehicleNumber}</strong><br />
                          • Model: {reminderModalRecord.notes || reminderModalRecord.vehicleType}<br />
                          • Govt Fee: ₹{reminderModalRecord.fee} 🚗
                        </p>
                        <p style={{ margin: '0 0 8px 0' }}>
                          Avoid heavy MVD / Police traffic fines of up to ₹2,000 by renewing your certificate today! 🛡️
                        </p>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#166534', background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px' }}>
                          📍 Center: {user.full_name || 'AE Pollution Testing & Fitness Center'}<br />
                          📞 Contact: {user.phone || '9847000000'}
                        </p>
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', fontSize: '11px', color: '#475569' }}>
                          <div>🗓️ Valid Until: {reminderModalRecord.expiryDate}</div>
                          <div>AE — Where customers meet businesses and beyond.</div>
                          <div style={{ color: '#2563eb', fontWeight: 700 }}>📲 Instagram: @ae.kerala</div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                          Terms & conditions apply.
                        </div>
                      </>
                    )}
                  </div>

                  {/* Timestamp & Double Blue Ticks */}
                  <div className="wa-bubble-time">
                    <span>10:30 AM</span>
                    <span className="ticks">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button 
                type="button" 
                className="button"
                style={{ 
                  flex: 1, 
                  background: 'linear-gradient(135deg, #25D366 0%, #16a34a 100%)', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                }}
                onClick={() => handleSendReminder(reminderModalRecord)}
              >
                <MessageCircle size={18} />
                <span>{uiText("Open & Send in WhatsApp")}</span>
              </button>
              <button 
                type="button" 
                className="button secondary" 
                onClick={() => setReminderModalRecord(null)}
                style={{ borderRadius: '12px', padding: '12px 18px', fontWeight: 700 }}
              >
                {uiText("Close")}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="expiry-toast-pill">
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
