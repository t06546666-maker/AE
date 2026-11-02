import { useState, useRef, useEffect, type FormEvent, type ChangeEvent, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Send,
  Calendar,
  Clock,
  ImagePlus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Users,
  User,
  UserCheck,
  Store,
  Globe,
  Smartphone,
  Sparkles,
  Upload,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  Plus,
} from 'lucide-react';
import { apiFetch } from '../api';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/Common';
import { useToast } from '../toast';
import { uiText } from '../uiText';
import { formatDateTime } from '../utils';

interface NotificationStats {
  customerTokens: number;
  totalOnboardedCustomers?: number;
  merchantTokens: number;
  totalOnboardedMerchants?: number;
  totalTokens: number;
}

interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string;
  customer_code: string;
  hasPushToken: boolean;
}

interface MerchantPushStatusItem {
  id: string;
  merchant_code: string;
  name: string;
  phone: string;
  email: string;
  hasPushToken: boolean;
  status: 'active' | 'pending';
  updated_at?: string | null;
}

interface MerchantPushStatusResponse {
  success: boolean;
  summary: {
    total: number;
    active: number;
    pending: number;
  };
  merchants: MerchantPushStatusItem[];
}

export type NotificationTarget = 'customers' | 'selected_customers' | 'merchants' | 'selected_merchants' | 'all' | 'single_customer';

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  image_url?: string;
  target: NotificationTarget;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_ids?: string[];
  merchant_ids?: string[];
  target_summary?: string;
  target_count?: number;
  scheduled_at: string;
  status: string;
  created_at?: string;
}

interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  url?: string;
  image_url?: string;
  target: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_ids?: string[];
  merchant_ids?: string[];
  target_summary?: string;
  target_count?: number;
  sent_at: string;
  delivered: number;
  failed: number;
  total: number;
}

interface HistoryResponse {
  scheduled: ScheduledNotification[];
  history: NotificationHistoryItem[];
}

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Form states
  const [target, setTarget] = useState<NotificationTarget>('customers');
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerSearchResult[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedMerchants, setSelectedMerchants] = useState<MerchantPushStatusItem[]>([]);
  const [merchantPickerSearchQuery, setMerchantPickerSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [dispatchMode, setDispatchMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'scheduled' | 'history'>('create');

  // Handle URL query parameters for pre-selecting a customer or merchant
  useEffect(() => {
    const custId = searchParams.get('customerId');
    const custName = searchParams.get('customerName');
    const custPhone = searchParams.get('customerPhone');
    if (custId) {
      setTarget('selected_customers');
      setSelectedCustomers((prev) => {
        if (prev.some((c) => c.id === custId)) return prev;
        return [
          ...prev,
          {
            id: custId,
            name: custName ? decodeURIComponent(custName) : 'Customer',
            phone: custPhone ? decodeURIComponent(custPhone) : '',
            customer_code: '',
            hasPushToken: true,
          },
        ];
      });
    }

    const merchId = searchParams.get('merchantId');
    const merchName = searchParams.get('merchantName');
    if (merchId) {
      setTarget('selected_merchants');
      setSelectedMerchants((prev) => {
        if (prev.some((m) => m.id === merchId)) return prev;
        return [
          ...prev,
          {
            id: merchId,
            merchant_code: '',
            name: merchName ? decodeURIComponent(merchName) : 'Merchant Store',
            phone: '',
            email: '',
            hasPushToken: true,
            status: 'active',
          },
        ];
      });
    }
  }, [searchParams]);

  // Stats query
  const { data: statsData } = useQuery<NotificationStats>({
    queryKey: ['admin', 'notifications', 'stats'],
    queryFn: () => apiFetch<NotificationStats>('/api/admin/notifications/stats'),
    staleTime: 30_000,
  });

  // History & scheduled list query
  const { data: historyData, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useQuery<HistoryResponse>({
    queryKey: ['admin', 'notifications', 'history'],
    queryFn: () => apiFetch<HistoryResponse>('/api/admin/notifications/history'),
    staleTime: 15_000,
  });

  // Customer search query (debounced)
  const { data: customerSearchResults, isFetching: searchingCustomers } = useQuery<{ success: boolean; customers: CustomerSearchResult[] }>({
    queryKey: ['admin', 'customers', 'search-push', customerSearchQuery],
    queryFn: () => apiFetch<{ success: boolean; customers: CustomerSearchResult[] }>(`/api/admin/customers/search-push?q=${encodeURIComponent(customerSearchQuery.trim())}`),
    enabled: (target === 'selected_customers' || target === 'single_customer') && customerSearchQuery.trim().length >= 1,
    staleTime: 10_000,
  });

  // Merchant push status modal & picker state & query
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');

  const { data: merchantStatusData, isFetching: loadingMerchantStatus, refetch: refetchMerchantStatus } = useQuery<MerchantPushStatusResponse>({
    queryKey: ['admin', 'merchants', 'push-status'],
    queryFn: () => apiFetch<MerchantPushStatusResponse>('/api/admin/merchants/push-status'),
    enabled: showMerchantModal || target === 'selected_merchants',
    staleTime: 10_000,
  });

  const filteredMerchants = useMemo(() => {
    const list = merchantStatusData?.merchants || [];
    if (!merchantSearchQuery.trim()) return list;
    const q = merchantSearchQuery.toLowerCase();
    return list.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.merchant_code.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q)
    );
  }, [merchantStatusData, merchantSearchQuery]);

  // Quick instant search for the merchant picker
  const merchantPickerFiltered = useMemo(() => {
    const list = merchantStatusData?.merchants || [];
    if (!merchantPickerSearchQuery.trim()) return list.slice(0, 10);
    const q = merchantPickerSearchQuery.toLowerCase();
    return list.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.merchant_code.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    ).slice(0, 25);
  }, [merchantStatusData, merchantPickerSearchQuery]);

  // Image selection handler
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please select a JPG, PNG, or WebP image.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB.', 'error');
      return;
    }

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add/remove customer helpers
  const handleAddCustomer = (c: CustomerSearchResult) => {
    setSelectedCustomers((prev) => {
      if (prev.some((item) => item.id === c.id)) return prev;
      return [...prev, c];
    });
  };

  const handleRemoveCustomer = (id: string) => {
    setSelectedCustomers((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddAllSearchCustomers = () => {
    if (!customerSearchResults?.customers) return;
    setSelectedCustomers((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newItems = customerSearchResults.customers.filter((c) => !existingIds.has(c.id));
      return [...prev, ...newItems];
    });
  };

  // Add/remove merchant helpers
  const handleAddMerchant = (m: MerchantPushStatusItem) => {
    setSelectedMerchants((prev) => {
      if (prev.some((item) => item.id === m.id)) return prev;
      return [...prev, m];
    });
  };

  const handleRemoveMerchant = (id: string) => {
    setSelectedMerchants((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddAllActiveMerchants = () => {
    const activeList = (merchantStatusData?.merchants || []).filter((m) => m.hasPushToken);
    setSelectedMerchants((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const toAdd = activeList.filter((m) => !existingIds.has(m.id));
      return [...prev, ...toAdd];
    });
  };

  // Broadcast mutation
  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('body', body.trim());
      if (url.trim()) form.append('url', url.trim());
      form.append('target', target);

      if (target === 'selected_customers' || target === 'single_customer') {
        const cIds = selectedCustomers.map((c) => c.id);
        form.append('customerIds', JSON.stringify(cIds));
        const cNames = selectedCustomers.map((c) => c.name);
        form.append('customerNames', JSON.stringify(cNames));
        form.append('targetSummary', `${selectedCustomers.length} Customer${selectedCustomers.length === 1 ? '' : 's'} (${selectedCustomers.slice(0, 3).map((c) => c.name).join(', ')}${selectedCustomers.length > 3 ? '...' : ''})`);
        if (selectedCustomers[0]) {
          form.append('customerId', selectedCustomers[0].id);
          form.append('customerName', selectedCustomers[0].name);
          form.append('customerPhone', selectedCustomers[0].phone);
        }
      }

      if (target === 'selected_merchants') {
        const mIds = selectedMerchants.map((m) => m.id);
        form.append('merchantIds', JSON.stringify(mIds));
        const mNames = selectedMerchants.map((m) => m.name);
        form.append('merchantNames', JSON.stringify(mNames));
        form.append('targetSummary', `${selectedMerchants.length} Store${selectedMerchants.length === 1 ? '' : 's'} (${selectedMerchants.slice(0, 3).map((m) => m.name).join(', ')}${selectedMerchants.length > 3 ? '...' : ''})`);
        if (selectedMerchants[0]) {
          form.append('merchantId', selectedMerchants[0].id);
          form.append('merchantName', selectedMerchants[0].name);
        }
      }

      if (dispatchMode === 'schedule' && scheduledDateTime) {
        form.append('scheduled_at', new Date(scheduledDateTime).toISOString());
      }

      if (imageFile) {
        form.append('image', imageFile);
      }

      return apiFetch<{ success: boolean; scheduled?: boolean; delivered?: number; message?: string }>('/api/admin/broadcast-notification', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (data) => {
      if (data.scheduled) {
        showToast(data.message || 'Notification scheduled successfully!');
      } else {
        showToast(data.message || 'Notification sent successfully!');
      }

      // Reset form
      setTitle('');
      setBody('');
      setUrl('');
      handleRemoveImage();
      setDispatchMode('now');
      setScheduledDateTime('');
      setSelectedCustomers([]);
      setSelectedMerchants([]);

      void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      setActiveTab(data.scheduled ? 'scheduled' : 'history');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to send notification', 'error');
    },
  });

  // Cancel scheduled mutation
  const cancelScheduledMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch<{ success: boolean; message: string }>(`/api/admin/notifications/scheduled/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      showToast('Scheduled notification cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications', 'history'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to cancel scheduled notification', 'error');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((target === 'selected_customers' || target === 'single_customer') && selectedCustomers.length === 0) {
      showToast('Please search and add at least one customer first.', 'error');
      return;
    }
    if (target === 'selected_merchants' && selectedMerchants.length === 0) {
      showToast('Please search and add at least one merchant store first.', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Please enter a notification title', 'error');
      return;
    }
    if (!body.trim()) {
      showToast('Please enter a notification message body', 'error');
      return;
    }
    if (dispatchMode === 'schedule') {
      if (!scheduledDateTime) {
        showToast('Please choose a scheduled date and time', 'error');
        return;
      }
      if (new Date(scheduledDateTime).getTime() <= Date.now() + 30_000) {
        showToast('Scheduled time must be at least 1 minute in the future', 'error');
        return;
      }
    }
    broadcastMutation.mutate();
  };

  // Min datetime for HTML datetime-local input
  const minDateTime = useMemo(() => {
    const now = new Date(Date.now() + 60_000);
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  const scheduledCount = historyData?.scheduled?.length || 0;
  const historyList = historyData?.history || [];

  return (
    <div className="admin-notifications-page" style={{ paddingBottom: '70px', maxWidth: '1200px', margin: '0 auto' }}>
      <PageHeader
        title={uiText("Push Notifications & Broadcasts")}
        subtitle={uiText("Send immediate or scheduled push notifications with rich images and redirect links to all customers, merchants, or a specific customer.")}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="button secondary"
              onClick={() => {
                void refetchHistory();
                void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications', 'stats'] });
                void queryClient.invalidateQueries({ queryKey: ['admin', 'merchants', 'push-status'] });
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title={uiText("Refresh stats and history")}
            >
              <RefreshCw size={15} />
              <span>{uiText("Refresh")}</span>
            </button>
          </div>
        }
      />

      {/* Audience Stats Bar */}
      <div
        className="panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          borderRadius: '16px',
          border: '1px solid #dbeafe',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Smartphone size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {uiText("Customer Phones Active")}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
              {statsData?.customerTokens ?? '...'} {uiText("Devices")}
              {statsData?.totalOnboardedCustomers ? (
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                  ({uiText("of {{count}} onboarded", { count: statsData.totalOnboardedCustomers })})
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Store size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {uiText("Merchant Phones Active")}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
              {statsData?.merchantTokens ?? 0} {uiText("Devices")}
              {statsData?.totalOnboardedMerchants ? (
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                  ({uiText("of {{count}} onboarded", { count: statsData.totalOnboardedMerchants })})
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setShowMerchantModal(true)}
              style={{
                marginTop: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>{uiText("View Device Status →")}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {uiText("FCM Cloud Messaging")}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>
              {uiText("100% Free / Unlimited")}
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', marginBottom: 20 }}>
        <Sparkles size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
        <span>
          {uiText("Active devices receive instant lockscreen push alerts. In-app announcements are automatically delivered to 100% of all onboarded customers and merchants upon app open.")}
        </span>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'create' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'create' ? '#2563eb' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Send size={16} />
          <span>{uiText("New Broadcast")}</span>
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'scheduled' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'scheduled' ? '#2563eb' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Calendar size={16} />
          <span>{uiText("Scheduled Queue")}</span>
          {scheduledCount > 0 && (
            <span style={{ background: '#2563eb', color: '#fff', fontSize: '11px', padding: '2px 7px', borderRadius: '12px' }}>
              {scheduledCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'history' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'history' ? '#2563eb' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Bell size={16} />
          <span>{uiText("Past Broadcasts")}</span>
          {historyList.length > 0 && (
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '2px 7px', borderRadius: '12px' }}>
              {historyList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CREATE / SEND NOTIFICATION */}
      {activeTab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: '28px', alignItems: 'start' }}>
          {/* Form */}
          <form onSubmit={handleSubmit} className="panel" style={{ padding: '24px', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={20} className="text-blue-600" />
              <span>{uiText("Compose Message")}</span>
            </h2>

            {/* Audience Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                {uiText("Target Audience")}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTarget('customers')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: target === 'customers' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: target === 'customers' ? '#eff6ff' : '#fff',
                    color: target === 'customers' ? '#1d4ed8' : '#475569',
                    fontWeight: target === 'customers' ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}
                >
                  <Users size={17} />
                  <span>{uiText("All Customers")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('selected_customers')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: (target === 'selected_customers' || target === 'single_customer') ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: (target === 'selected_customers' || target === 'single_customer') ? '#eff6ff' : '#fff',
                    color: (target === 'selected_customers' || target === 'single_customer') ? '#1d4ed8' : '#475569',
                    fontWeight: (target === 'selected_customers' || target === 'single_customer') ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    position: 'relative',
                  }}
                >
                  <UserCheck size={17} />
                  <span>{uiText("Selected Customers")}</span>
                  {selectedCustomers.length > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 6, background: '#2563eb', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '10px', padding: '1px 5px' }}>
                      {selectedCustomers.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('merchants')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: target === 'merchants' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: target === 'merchants' ? '#eff6ff' : '#fff',
                    color: target === 'merchants' ? '#1d4ed8' : '#475569',
                    fontWeight: target === 'merchants' ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}
                >
                  <Store size={17} />
                  <span>{uiText("All Merchants")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('selected_merchants')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: target === 'selected_merchants' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: target === 'selected_merchants' ? '#eff6ff' : '#fff',
                    color: target === 'selected_merchants' ? '#1d4ed8' : '#475569',
                    fontWeight: target === 'selected_merchants' ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    position: 'relative',
                  }}
                >
                  <Store size={17} />
                  <span>{uiText("Selected Merchants")}</span>
                  {selectedMerchants.length > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 6, background: '#2563eb', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '10px', padding: '1px 5px' }}>
                      {selectedMerchants.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('all')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: target === 'all' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: target === 'all' ? '#eff6ff' : '#fff',
                    color: target === 'all' ? '#1d4ed8' : '#475569',
                    fontWeight: target === 'all' ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}
                >
                  <Globe size={17} />
                  <span>{uiText("Everyone")}</span>
                </button>
              </div>
            </div>

            {/* If Selected Customers is target, show Multi-Customer Picker */}
            {(target === 'selected_customers' || target === 'single_customer') && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck size={16} className="text-blue-600" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                      {uiText("Select Specific Customers")} <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    {selectedCustomers.length > 0 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>
                        {selectedCustomers.length} {uiText("selected")}
                      </span>
                    )}
                  </div>

                  {selectedCustomers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomers([]);
                        setSearchParams({});
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '12px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: '2px 6px',
                      }}
                    >
                      {uiText("Clear all ({{count}})", { count: selectedCustomers.length })}
                    </button>
                  )}
                </div>

                {/* Selected customer chips */}
                {selectedCustomers.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', maxHeight: '180px', overflowY: 'auto', padding: '4px 0' }}>
                    {selectedCustomers.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          background: '#fff',
                          borderRadius: '20px',
                          border: '1px solid #cbd5e1',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                          {c.name.slice(0, 1).toUpperCase() || 'C'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                            {c.name}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            {c.phone || c.customer_code}
                          </span>
                        </div>
                        {c.hasPushToken ? (
                          <span title={uiText("Phone push active")} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '8px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                            ● Push
                          </span>
                        ) : (
                          <span title={uiText("In-app inbox only")} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '8px', background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>
                            In-App
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomer(c.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px',
                          }}
                          title={uiText("Remove")}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                    {uiText("No customers selected yet. Search below to add customers (you can select multiple).")}
                  </p>
                )}

                {/* Customer Search Box */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    placeholder={uiText("Search customer by name, phone number, or code to add...")}
                    style={{ width: '100%', fontSize: '13px', padding: '10px 14px 10px 36px' }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  {searchingCustomers && (
                    <RefreshCw size={14} className="spin" style={{ position: 'absolute', right: '12px', top: '13px', color: '#2563eb' }} />
                  )}
                </div>

                {/* Customer Search Results */}
                {customerSearchResults?.customers && customerSearchResults.customers.length > 0 && (
                  <div style={{ marginTop: '8px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      <span>{uiText("Matching Customers ({{count}}):", { count: customerSearchResults.customers.length })}</span>
                      <button
                        type="button"
                        onClick={handleAddAllSearchCustomers}
                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}
                      >
                        {uiText("+ Add All ({{count}})", { count: customerSearchResults.customers.length })}
                      </button>
                    </div>

                    {customerSearchResults.customers.map((c) => {
                      const isAdded = selectedCustomers.some((item) => item.id === c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (!isAdded) handleAddCustomer(c);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: isAdded ? 'default' : 'pointer',
                            opacity: isAdded ? 0.6 : 1,
                            background: isAdded ? '#f8fafc' : '#fff',
                          }}
                          onMouseEnter={(e) => {
                            if (!isAdded) e.currentTarget.style.background = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            if (!isAdded) e.currentTarget.style.background = isAdded ? '#f8fafc' : '#fff';
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{c.phone} {c.customer_code ? `• ${c.customer_code}` : ''}</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {c.hasPushToken ? (
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                                ● {uiText("Push Ready")}
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b' }}>
                                {uiText("In-App Only")}
                              </span>
                            )}

                            {isAdded ? (
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Check size={13} />
                                {uiText("Added")}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Plus size={13} />
                                {uiText("Add")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {customerSearchQuery.trim().length >= 2 && customerSearchResults?.customers?.length === 0 && !searchingCustomers && (
                  <div style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                    {uiText("No customer found matching your search.")}
                  </div>
                )}
              </div>
            )}

            {/* If Selected Merchants is target, show Multi-Merchant Picker */}
            {target === 'selected_merchants' && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Store size={16} className="text-blue-600" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                      {uiText("Select Specific Merchant Stores")} <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    {selectedMerchants.length > 0 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>
                        {selectedMerchants.length} {uiText("selected")}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {merchantStatusData?.merchants && (
                      <button
                        type="button"
                        onClick={handleAddAllActiveMerchants}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: '#059669',
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: '2px 6px',
                        }}
                      >
                        {uiText("+ Add All Push Active Stores ({{count}})", {
                          count: merchantStatusData.merchants.filter((m) => m.hasPushToken).length,
                        })}
                      </button>
                    )}

                    {selectedMerchants.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMerchants([]);
                          setSearchParams({});
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '12px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: '2px 6px',
                        }}
                      >
                        {uiText("Clear all ({{count}})", { count: selectedMerchants.length })}
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected merchant chips */}
                {selectedMerchants.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', maxHeight: '180px', overflowY: 'auto', padding: '4px 0' }}>
                    {selectedMerchants.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          background: '#fff',
                          borderRadius: '20px',
                          border: '1px solid #cbd5e1',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                          <Store size={12} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                            {m.name}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            {m.merchant_code} {m.phone ? `• ${m.phone}` : ''}
                          </span>
                        </div>
                        {m.hasPushToken ? (
                          <span title={uiText("Phone push active")} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '8px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                            ● Push
                          </span>
                        ) : (
                          <span title={uiText("In-app inbox only")} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '8px', background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>
                            Pending
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMerchant(m.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px',
                          }}
                          title={uiText("Remove")}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                    {uiText("No stores selected yet. Search below to add stores (you can select multiple stores).")}
                  </p>
                )}

                {/* Merchant Search Box */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input"
                    value={merchantPickerSearchQuery}
                    onChange={(e) => setMerchantPickerSearchQuery(e.target.value)}
                    placeholder={uiText("Search store by name, merchant code (e.g. MER022), or phone...")}
                    style={{ width: '100%', fontSize: '13px', padding: '10px 14px 10px 36px' }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  {loadingMerchantStatus && (
                    <RefreshCw size={14} className="spin" style={{ position: 'absolute', right: '12px', top: '13px', color: '#2563eb' }} />
                  )}
                </div>

                {/* Merchant Results */}
                {merchantPickerFiltered.length > 0 && (
                  <div style={{ marginTop: '8px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto' }}>
                    <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      {uiText("Available Stores:")}
                    </div>

                    {merchantPickerFiltered.map((m) => {
                      const isAdded = selectedMerchants.some((item) => item.id === m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (!isAdded) handleAddMerchant(m);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: isAdded ? 'default' : 'pointer',
                            opacity: isAdded ? 0.6 : 1,
                            background: isAdded ? '#f8fafc' : '#fff',
                          }}
                          onMouseEnter={(e) => {
                            if (!isAdded) e.currentTarget.style.background = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            if (!isAdded) e.currentTarget.style.background = isAdded ? '#f8fafc' : '#fff';
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {m.merchant_code} {m.phone ? `• ${m.phone}` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {m.hasPushToken ? (
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                                ● {uiText("Push Active")}
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b' }}>
                                {uiText("Pending App")}
                              </span>
                            )}

                            {isAdded ? (
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Check size={13} />
                                {uiText("Added")}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Plus size={13} />
                                {uiText("Add")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {uiText("Notification Title")} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How to use AE 🚀 or Weekend Bonus Deals!"
                maxLength={90}
                style={{ width: '100%', fontSize: '14px', padding: '10px 14px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                <span>{uiText("Keep it short and punchy for the phone lock screen.")}</span>
                <span>{title.length}/90</span>
              </div>
            </div>

            {/* Message Body */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {uiText("Notification Message Body")} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                className="input"
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="e.g. Tap to watch our step-by-step video on how to earn cashback points, redeem gifts, and place instant grocery orders on WhatsApp!"
                maxLength={400}
                style={{ width: '100%', fontSize: '14px', padding: '10px 14px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                <span>{uiText("Displayed in full on customer in-app notifications and phone tray.")}</span>
                <span>{body.length}/400</span>
              </div>
            </div>

            {/* Redirect URL / Post Link */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {uiText("Redirect Link / Post URL (Optional)")}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. https://instagram.com/p/... or https://youtu.be/... or /customer/offers"
                  style={{ width: '100%', fontSize: '14px', padding: '10px 14px 10px 36px' }}
                />
                <ExternalLink size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              </div>
              <p style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                {uiText("When the customer taps the notification, they will be redirected to this post, video, or app page.")}
              </p>
            </div>

            {/* Optional Banner Image */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {uiText("Banner Image (Optional - Rich Push Notification)")}
              </label>

              {imagePreview ? (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', maxHeight: '200px' }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={uiText("Remove Image")}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#f8fafc',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <ImagePlus size={32} style={{ color: '#64748b', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                    {uiText("Click to upload high-impact banner image")}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {uiText("JPG, PNG, WebP up to 5MB (Big Picture notification banner)")}
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Timing / Schedule Options */}
            <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                {uiText("When to Send?")}
              </label>

              <div style={{ display: 'flex', gap: '20px', marginBottom: dispatchMode === 'schedule' ? '12px' : '0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  <input
                    type="radio"
                    name="dispatchMode"
                    value="now"
                    checked={dispatchMode === 'now'}
                    onChange={() => setDispatchMode('now')}
                  />
                  <span>{uiText("Send Immediately ⚡")}</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  <input
                    type="radio"
                    name="dispatchMode"
                    value="schedule"
                    checked={dispatchMode === 'schedule'}
                    onChange={() => setDispatchMode('schedule')}
                  />
                  <span>{uiText("Schedule for Later ⏰")}</span>
                </label>
              </div>

              {dispatchMode === 'schedule' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    {uiText("Select Date & Time:")}
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    min={minDateTime}
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    style={{ width: '100%', fontSize: '14px', padding: '8px 12px' }}
                    required={dispatchMode === 'schedule'}
                  />
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    {uiText("Our background server scheduler will automatically dispatch this push notification at the exact specified time.")}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="button primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '10px',
              }}
            >
              {broadcastMutation.isPending ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  <span>{dispatchMode === 'schedule' ? uiText("Scheduling Notification...") : uiText("Broadcasting to Phones...")}</span>
                </>
              ) : dispatchMode === 'schedule' ? (
                <>
                  <Calendar size={18} />
                  <span>{uiText("Schedule Notification")}</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>
                    {target === 'selected_customers' || target === 'single_customer'
                      ? (selectedCustomers.length > 0 ? uiText("Send Push to {{count}} Customer(s) Now", { count: selectedCustomers.length }) : uiText("Send Push to Customers Now"))
                      : target === 'selected_merchants'
                      ? (selectedMerchants.length > 0 ? uiText("Send Push to {{count}} Store(s) Now", { count: selectedMerchants.length }) : uiText("Send Push to Stores Now"))
                      : target === 'merchants'
                      ? uiText("Send Push to All Merchants Now")
                      : target === 'all'
                      ? uiText("Broadcast to Everyone Now")
                      : uiText("Send Push to All Customers Now")}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Right Column: Live Mobile Preview */}
          <div>
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Smartphone size={18} className="text-slate-600" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                {target === 'selected_customers' || target === 'single_customer'
                  ? (selectedCustomers.length > 0
                      ? uiText("Live Preview for {{count}} Customer(s) ({{names}})", {
                          count: selectedCustomers.length,
                          names: selectedCustomers.slice(0, 2).map((c) => c.name).join(', ') + (selectedCustomers.length > 2 ? '...' : ''),
                        })
                      : uiText("Live Preview (No customers selected)"))
                  : target === 'selected_merchants'
                  ? (selectedMerchants.length > 0
                      ? uiText("Live Preview for {{count}} Store(s) ({{names}})", {
                          count: selectedMerchants.length,
                          names: selectedMerchants.slice(0, 2).map((m) => m.name).join(', ') + (selectedMerchants.length > 2 ? '...' : ''),
                        })
                      : uiText("Live Preview (No stores selected)"))
                  : target === 'merchants'
                  ? uiText("Live Phone Preview (All Merchants)")
                  : target === 'all'
                  ? uiText("Live Phone Preview (Everyone)")
                  : uiText("Live Phone Preview (All Customers)")}
              </h3>
            </div>

            <div
              style={{
                background: '#0f172a',
                borderRadius: '32px',
                padding: '16px',
                border: '8px solid #334155',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                minHeight: '480px',
                color: '#fff',
                position: 'sticky',
                top: '20px',
              }}
            >
              {/* Phone Status Bar Mockup */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', padding: '0 8px 14px' }}>
                <span>10:30 AM</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Notification Banner Mockup */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  color: '#0f172a',
                  borderRadius: '20px',
                  padding: '14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '11px' }}>
                      AE
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>Affiliate AE</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>• Just now</span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '4px', lineHeight: 1.3 }}>
                  {title || uiText("Notification Title")}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, whiteSpace: 'pre-wrap', marginBottom: imagePreview ? '10px' : '6px' }}>
                  {body || uiText("Your notification message will appear here on customer phones.")}
                </div>

                {/* Optional Image */}
                {imagePreview && (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '10px', maxHeight: '160px', border: '1px solid #e2e8f0' }}>
                    <img src={imagePreview} alt="Push banner" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  </div>
                )}

                {/* Optional Link Button */}
                {url && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#2563eb',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#eff6ff',
                      }}
                    >
                      <span>{uiText("Open Post / Link")}</span>
                      <ExternalLink size={11} />
                    </span>
                  </div>
                )}
              </div>

              {/* Helper text below mockup */}
              <div style={{ marginTop: '20px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                <p>
                  <strong>{uiText("Big Picture Rich Push:")}</strong> {uiText("When an image is included, Android and iOS expand the notification to show the full image banner.")}
                </p>
                <p style={{ marginTop: '6px' }}>
                  <strong>{uiText("In-App Bell Inbox:")}</strong> {uiText("The notification and image are permanently saved in the customer app's notification bell.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULED QUEUE */}
      {activeTab === 'scheduled' && (
        <div className="panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{uiText("Scheduled Notifications Queue")}</h2>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                {uiText("These notifications will automatically broadcast when their scheduled time arrives.")}
              </p>
            </div>
          </div>

          {scheduledCount === 0 ? (
            <EmptyState>
              <Calendar size={36} className="text-slate-400" />
              <p style={{ marginTop: '8px', fontWeight: 600 }}>{uiText("No scheduled notifications in queue.")}</p>
              <button className="button primary" onClick={() => setActiveTab('create')} style={{ marginTop: '12px' }}>
                {uiText("Create New Scheduled Push")}
              </button>
            </EmptyState>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {historyData?.scheduled.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: '240px', flex: '1 1 300px' }}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt="thumb"
                        style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b',
                        }}
                      >
                        <Bell size={24} />
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{item.title}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                          {item.target === 'selected_customers' || item.target === 'single_customer'
                            ? (item.target_summary || (item.target_count && item.target_count > 1 ? `${item.target_count} Selected Customers` : (item.customer_name ? `Customer: ${item.customer_name}` : uiText("Selected Customers"))))
                            : item.target === 'selected_merchants'
                            ? (item.target_summary || (item.target_count && item.target_count > 1 ? `${item.target_count} Selected Stores` : uiText("Selected Merchants")))
                            : item.target === 'merchants'
                            ? uiText("All Merchants")
                            : item.target === 'all'
                            ? uiText("Everyone")
                            : uiText("All Customers")}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#475569', marginBottom: '4px', maxWidth: '480px' }}>{item.body}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '12px', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>{item.url}</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        {uiText("Scheduled For")}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={15} />
                        <span>{formatDateTime(item.scheduled_at)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={cancelScheduledMutation.isPending}
                      onClick={() => cancelScheduledMutation.mutate(item.id)}
                      className="button secondary"
                      style={{ color: '#ef4444', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Trash2 size={15} />
                      <span>{uiText("Cancel")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BROADCAST HISTORY */}
      {activeTab === 'history' && (
        <div className="panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{uiText("Past Push Notification Broadcasts")}</h2>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                {uiText("Log of all broadcast notifications sent to devices and recorded in in-app inboxes.")}
              </p>
            </div>
          </div>

          {historyList.length === 0 ? (
            <EmptyState>
              <Bell size={36} className="text-slate-400" />
              <p style={{ marginTop: '8px', fontWeight: 600 }}>{uiText("No broadcast notifications have been sent yet.")}</p>
            </EmptyState>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {historyList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: '240px', flex: '1 1 300px' }}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt="thumb"
                        style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          background: '#eff6ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#2563eb',
                        }}
                      >
                        <CheckCircle2 size={24} />
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{item.title}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                          {item.target === 'selected_customers' || item.target === 'single_customer'
                            ? (item.target_summary || (item.target_count && item.target_count > 1 ? `${item.target_count} Selected Customers` : (item.customer_name ? `Customer: ${item.customer_name}` : uiText("Selected Customers"))))
                            : item.target === 'selected_merchants'
                            ? (item.target_summary || (item.target_count && item.target_count > 1 ? `${item.target_count} Selected Stores` : uiText("Selected Merchants")))
                            : item.target === 'merchants'
                            ? uiText("All Merchants")
                            : item.target === 'all'
                            ? uiText("Everyone")
                            : uiText("All Customers")}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#475569', marginBottom: '4px', maxWidth: '480px' }}>{item.body}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '12px', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>{item.url}</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        {uiText("Sent At")}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        {formatDateTime(item.sent_at)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        {uiText("Delivered")}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={15} />
                        <span>{item.delivered} / {item.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Merchant Device Push Status Modal */}
      {showMerchantModal && (
        <div className="modal-backdrop" onClick={() => setShowMerchantModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Store size={20} className="text-blue-600" />
                  <span>{uiText("Merchant Device Push Status")}</span>
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {uiText("Live FCM push registration for all onboarded merchant stores")}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void refetchMerchantStatus()}
                  disabled={loadingMerchantStatus}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px' }}
                  title={uiText("Refresh status")}
                >
                  <RefreshCw size={13} className={loadingMerchantStatus ? 'animate-spin' : ''} />
                  <span>{loadingMerchantStatus ? uiText("Refreshing…") : uiText("Refresh")}</span>
                </button>
                <button type="button" className="icon-button modal-close" onClick={() => setShowMerchantModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Summary Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857' }}>
                  {merchantStatusData?.summary.active ?? 0}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#065f46' }}>
                  {uiText("🟢 Active Devices")}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#64748b' }}>
                  {merchantStatusData?.summary.pending ?? 0}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                  {uiText("⚪ Pending App Open")}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #dbeafe', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8' }}>
                  {merchantStatusData?.summary.total ?? 0}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af' }}>
                  {uiText("Total Stores")}
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={merchantSearchQuery}
                onChange={(e) => setMerchantSearchQuery(e.target.value)}
                placeholder={uiText("Search merchant name, phone, or code…")}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            {/* Merchant List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', minHeight: '160px', maxHeight: '380px' }}>
              {loadingMerchantStatus && !merchantStatusData ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>{uiText("Checking merchant devices…")}</div>
              ) : filteredMerchants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>{uiText("No matching merchants found.")}</div>
              ) : (
                filteredMerchants.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: m.hasPushToken ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      background: m.hasPushToken ? '#f0fdf4' : '#fff',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {m.merchant_code} · {m.phone} · {m.email}
                      </div>
                    </div>
                    <div>
                      {m.hasPushToken ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
                          {uiText("🟢 Active")}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1' }} />
                          {uiText("⚪ Pending App")}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {uiText("When field manager enables notifications on phone and opens AE app, click Refresh to see it turn Active.")}
              </span>
              <button type="button" className="button secondary" onClick={() => setShowMerchantModal(false)}>
                {uiText("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
