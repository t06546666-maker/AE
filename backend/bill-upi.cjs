function billUpi(settings, bill) {
  const upiId = String(settings?.upiId || '').trim().toLowerCase();
  const amount = Number(bill.payable);
  if (!(settings?.pilotUpiEnabled || settings?.paymentEnabled) || !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(upiId) || !Number.isFinite(amount) || amount <= 0) return { upiId: null, upiUrl: null };
  const params = new URLSearchParams({ pa: upiId, pn: settings.displayName || bill.merchantName, am: amount.toFixed(2), cu: 'INR', tn: 'AE checkout', tr: String(bill.id) });
  return { upiId, upiUrl: `upi://pay?${params}` };
}
module.exports = { billUpi };
