function transactionDateBounds(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid transaction date.');
  const utc = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== value) throw new Error('Choose a valid transaction date.');
  const start = utc.getTime() - 330 * 60000;
  return { start: new Date(start).toISOString(), end: new Date(start + 86400000).toISOString() };
}
module.exports = { transactionDateBounds };
