export const productListStatuses = ['confirmed', 'in_progress', 'ready', 'rejected'] as const;
export function productListStatusLabel(status: string) {
  return ({ approved: 'Awaiting confirmation', pending: 'Pending review', accepted: 'Confirmed', confirmed: 'Confirmed', in_progress: 'In progress', ready: 'Order ready', rejected: 'Rejected' } as Record<string, string>)[status] || status;
}
