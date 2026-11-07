import { useState, useMemo, useEffect } from 'react';
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
  FileSpreadsheet
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
    notes: 'Honda Activa 6G',
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
    notes: 'Swift Dzire Diesel',
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
    notes: 'Hyundai i20',
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
    notes: 'Eicher Tipper',
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
    notes: 'Jupiter 125',
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
    notes: 'Innova Crysta',
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

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [reminderModalRecord, setReminderModalRecord] = useState<ExpiryRecord | null>(null);
  const [toastMessage, setToastMessage] = useState('');

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
    setTimeout(() => setToastMessage(''), 3000);
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

  // Add Record Handler
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newVehicle.trim() || !newPhone.trim()) {
      showToast('Please fill required fields (Name, Phone, Vehicle Number)');
      return;
    }

    const newRec: ExpiryRecord = {
      id: 'rec-' + Date.now(),
      customerName: newName.trim(),
      phone: newPhone.trim(),
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

  // WhatsApp Reminder Text Generator
  const getWhatsAppReminderText = (rec: ExpiryRecord) => {
    const shopName = user.full_name || 'AE Pollution Testing & Fitness Center';
    return `🔔 പ്രിയപ്പെട്ട ${rec.customerName},\n\nനിങ്ങളുടെ വാഹനം (${rec.vehicleNumber}) മലിനീകരണ നിയന്ത്രണ സർട്ടിഫിക്കറ്റ് (Pollution Certificate) കാലാവധി ${rec.expiryDate}-ൽ അവസാനിക്കുകയാണ്.\n\nപോലീസ് പിഴ ഒഴിവാക്കാൻ ഉടൻ തന്നെ ഞങ്ങളുടെ കേന്ദ്രത്തിൽ സന്ദർശിച്ച് പുതുക്കുക! 🚗💨\n\n📍 ${shopName}\n📞 ബന്ധപ്പെടുക: ${user.phone || '9847000000'}\n\nAE — Where customers meet businesses and beyond.`;
  };

  const handleSendReminder = (rec: ExpiryRecord) => {
    setRecords(prev => prev.map(item => item.id === rec.id ? { ...item, lastRemindedAt: new Date().toISOString() } : item));
    const msg = getWhatsAppReminderText(rec);
    const waUrl = `https://wa.me/91${rec.phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    setReminderModalRecord(null);
    showToast(`WhatsApp reminder opened for ${rec.customerName}!`);
  };

  return (
    <div className="expiry-manager-wrapper">
      <PageHeader 
        title={uiText("Renewal & Expiry Manager")} 
        subtitle="Manage customer vehicle certificates, track monthly expiry, and send WhatsApp renewal reminders."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="button secondary" 
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={16} />
              <span>{uiText("Export Excel / CSV")}</span>
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

      {/* Category Notice: Fixed Government Tariff Mode */}
      <div className="expiry-category-notice">
        <div className="expiry-category-notice-content">
          <span className="expiry-category-badge">🏛️ Fixed Government Tariff Category</span>
          <p>
            {uiText("For statutory fees like Vehicle Pollution & Testing, coin discount redemption is disabled. Instead, your automated renewal reminder system and customer register are fully active to maximize repeat business.")}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="expiry-stats-grid">
        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Total Vehicles</h4>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="expiry-stat-icon blue">
            <Car size={22} />
          </div>
        </div>

        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Expiring This Month</h4>
            <div className="stat-value" style={{ color: '#d97706' }}>{stats.expiringThisMonth}</div>
          </div>
          <div className="expiry-stat-icon amber">
            <CalendarClock size={22} />
          </div>
        </div>

        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Due Within 7 Days</h4>
            <div className="stat-value" style={{ color: '#c2410c' }}>{stats.urgentDue}</div>
          </div>
          <div className="expiry-stat-icon rose">
            <Clock size={22} />
          </div>
        </div>

        <div className="expiry-stat-card">
          <div className="expiry-stat-info">
            <h4>Overdue / Expired</h4>
            <div className="stat-value" style={{ color: '#b91c1c' }}>{stats.expired}</div>
          </div>
          <div className="expiry-stat-icon rose">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="expiry-toolbar">
        <div className="expiry-toolbar-left">
          <div className="expiry-search-box">
            <Search size={16} color="#64748b" />
            <input 
              type="text" 
              placeholder={uiText("Search name, vehicle KL-09..., or phone")} 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button type="button" onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={14} /></button>}
          </div>

          {/* Month Selector */}
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
            <option value="2-Wheeler Petrol">2-Wheeler Petrol (₹100)</option>
            <option value="4-Wheeler Petrol">4-Wheeler Petrol (₹120)</option>
            <option value="Diesel LMV (Car)">Diesel LMV Car (₹150)</option>
            <option value="Commercial HMV">Commercial HMV (₹200)</option>
          </select>
        </div>

        <div className="expiry-toolbar-actions">
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Showing {filteredRecords.length} of {records.length} records
          </span>
        </div>
      </div>

      {/* Main Records Table */}
      <div className="expiry-table-card">
        {filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
            <Car size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{uiText("No customer vehicle records found")}</h4>
            <p style={{ margin: '4px 0 16px', fontSize: '13px' }}>{uiText("Try adjusting your search or month filter, or add a new record.")}</p>
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
                  return (
                    <tr key={rec.id}>
                      <td>
                        <span className="reg-number-pill">
                          <Car size={13} color="#2563eb" />
                          <span>{rec.vehicleNumber}</span>
                        </span>
                        {rec.notes && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                            {rec.notes}
                          </div>
                        )}
                      </td>

                      <td>
                        <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>
                          {rec.customerName}
                        </strong>
                        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={11} /> {rec.phone}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{rec.vehicleType}</div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>
                          ₹{rec.fee} (Govt Fee)
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {rec.testDate}
                        </span>
                      </td>

                      <td>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                          {rec.expiryDate}
                        </strong>
                      </td>

                      <td>
                        <span className={`expiry-status-pill ${status.pillClass}`}>
                          {status.key === 'expired' && <AlertTriangle size={12} />}
                          {status.key === 'urgent' && <Clock size={12} />}
                          {status.key === 'valid' && <CheckCircle2 size={12} />}
                          <span>{status.label}</span>
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={`wa-remind-btn ${rec.lastRemindedAt ? 'reminded' : ''}`}
                          onClick={() => setReminderModalRecord(rec)}
                          title={rec.lastRemindedAt ? `Reminder already sent on ${rec.lastRemindedAt.slice(0, 10)}` : 'Send WhatsApp Reminder'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Car size={20} color="#2563eb" />
                <h3>{uiText("Add Vehicle & Expiry Entry")}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setAddModalOpen(false)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
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
                  placeholder="e.g. 9847123456" 
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
                <label>{uiText("Service / Vehicle Category")}</label>
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
                  <option value="2-Wheeler Petrol">2-Wheeler Petrol (₹100)</option>
                  <option value="4-Wheeler Petrol">4-Wheeler Petrol (₹120)</option>
                  <option value="Diesel LMV (Car)">Diesel LMV Car / Van (₹150)</option>
                  <option value="Commercial HMV">Commercial / Heavy Vehicle (₹200)</option>
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
                      // Auto calculate 6 months
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
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Quick Validity Preset:</span>
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

              <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
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

      {/* WHATSAPP REMINDER MODAL */}
      {reminderModalRecord && (
        <div className="expiry-modal-overlay" onClick={() => setReminderModalRecord(null)}>
          <div className="expiry-modal-box" onClick={e => e.stopPropagation()}>
            <div className="expiry-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={20} color="#25D366" />
                <h3>{uiText("WhatsApp Renewal Reminder")}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setReminderModalRecord(null)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '14px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{reminderModalRecord.customerName}</strong>
                <span className="reg-number-pill">{reminderModalRecord.vehicleNumber}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Phone: +91 {reminderModalRecord.phone} · Expiry: <strong>{reminderModalRecord.expiryDate}</strong>
              </div>
            </div>

            <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Message Preview:
            </label>
            <div className="wa-preview-bubble">
              {getWhatsAppReminderText(reminderModalRecord)}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button 
                type="button" 
                className="button"
                style={{ flex: 1, background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => handleSendReminder(reminderModalRecord)}
              >
                <MessageCircle size={16} />
                <span>{uiText("Open & Send in WhatsApp")}</span>
              </button>
              <button 
                type="button" 
                className="button secondary" 
                onClick={() => setReminderModalRecord(null)}
              >
                {uiText("Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0f172a',
          color: '#38bdf8',
          padding: '10px 20px',
          borderRadius: '9999px',
          fontSize: '13px',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
