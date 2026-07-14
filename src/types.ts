export type Role = 'admin' | 'merchant';
export type Period = 'today' | 'week' | 'month' | 'custom';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  merchant_id: string | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  phone: string;
  joined: string;
  orderCount?: number;
}

export interface Membership {
  merchantId: string;
  merchant: string;
  rewardPoints: number;
  qrScans: number;
  joinedAt: string;
}

export interface Customer {
  id: string;
  databaseId: string;
  name: string;
  phone: string;
  email: string;
  registeredAt: string;
  qrScans: number;
  rewardPoints: number;
  totalRewardPoints?: number;
  merchantId: string;
  merchant: string;
  merchantCount?: number;
  memberships?: Membership[];
  orderCount?: number;
  totalSpend?: number;
  isRetained?: boolean;
}

export interface Order {
  id: string;
  orderNo: string;
  cid: string;
  customer: string;
  phone: string;
  email: string;
  amount: number;
  merchant: string;
  location: string;
  rewardPoints: number;
  rewardPercentage: number;
  isReturning: boolean;
  source: 'registration' | 'qr';
  timestamp: string;
  whatsappStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'not_sent';
  emailSent: boolean;
}

export interface RewardSettings {
  rewardPercentage: number;
  rewardMinimum: number;
  rewardOptions: number[];
}

export interface DashboardData {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    rewardPointsIssued: number;
    totalCustomers: number;
  };
  intervals: Array<{ label: string; orders: number; revenue: number }>;
  retention: {
    lifetimeCustomers: number;
    selectedVisits: number;
    todayVisits: number;
    weekVisits: number;
    monthVisits: number;
  };
}

export interface MerchantSummaryResponse {
  merchant: Merchant;
  summary: {
    totalOrders: number;
    pointsIssued: number;
    totalCustomers: number;
    retainedCustomers: number;
    retentionRate: number;
  };
  customers: Customer[];
}

export interface Administrator {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  isCurrent: boolean;
}
