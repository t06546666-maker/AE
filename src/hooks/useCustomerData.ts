import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, queryString } from '../api';

export type ActivityItem = {
  id: string;
  created_at: string;
  type: 'earn' | 'redeem';
  merchant_name?: string;
  points: number;
};

export type CustomerDashboard = {
  reward_points: number;
  activity: ActivityItem[];
};

export type CustomerMerchant = {
  id: string;
  name: string;
  created_at: string;
};

export type CustomerOffer = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  merchant_name?: string;
  expires_at: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function useCustomerDashboard() {
  return useQuery({
    queryKey: ['customer', 'dashboard'],
    queryFn: ({ signal }) => apiFetch<CustomerDashboard>('/api/customer/dashboard', { signal })
  });
}

export function useCustomerTransactions(page: number) {
  return useQuery({
    queryKey: ['customer', 'transactions', page],
    queryFn: ({ signal }) => apiFetch<{ transactions: ActivityItem[], pagination: PaginationMeta }>(`/api/customer/transactions?${queryString({ page, pageSize: 20 })}`, { signal }),
    staleTime: 60000
  });
}

export function useCustomerMerchants(page: number, search?: string) {
  return useQuery({
    queryKey: ['customer', 'merchants', page, search],
    queryFn: ({ signal }) => apiFetch<{ merchants: CustomerMerchant[], pagination: PaginationMeta }>(`/api/customer/merchants?${queryString({ page, pageSize: 20, search })}`, { signal }),
    staleTime: 60000
  });
}

export function useCustomerOffers() {
  return useQuery({
    queryKey: ['customer', 'offers'],
    queryFn: ({ signal }) => apiFetch<{ offers: CustomerOffer[] }>('/api/customer/offers', { signal }),
    staleTime: 60000
  });
}

export function useCustomerRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) =>
      apiFetch<{ success: boolean; points_used: number }>('/api/customer/redeem', {
        method: 'POST',
        body: JSON.stringify({ offer_id: offerId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer'] });
    },
  });
}

export function useCustomerApplyReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ success: boolean; points_awarded: number }>('/api/customer/referral/apply', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer'] });
    },
  });
}

export function useUpdateCustomerPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: {
      push_token?: string;
      push_enabled?: boolean;
      whatsapp_enabled?: boolean;
      location_enabled?: boolean;
    }) =>
      apiFetch<{ success: boolean }>('/api/customer/preferences', {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer'] });
    },
  });
}
