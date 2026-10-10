// Keep one initial per word; never modify stored customer records.
function maskCustomerName(value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  if (value.includes('*')) return value;
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  return value.trim().split(/\s+/u).map(word => {
    const first = [...segmenter.segment(word)][0]?.segment || '';
    return first + '***';
  }).join(' ');
}
function maskCustomerResponse(value, customerContext = false) {
  if (Array.isArray(value)) return value.map(item => maskCustomerResponse(item, customerContext));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (['customer_name','customerName'].includes(key) || (key === 'customer' && typeof item === 'string') || (customerContext && key === 'name')) return [key, maskCustomerName(item)];
    return [key, maskCustomerResponse(item, ['customer','customers'].includes(key))];
  }));
}
module.exports = { maskCustomerName, maskCustomerResponse };
