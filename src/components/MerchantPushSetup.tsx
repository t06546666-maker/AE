export function MerchantPushSetup({ userId: _userId }: { userId?: string }) {
  // Push notifications are handled automatically in the background by App.tsx.
  // No visual UI banner is needed.
  return null;
}
