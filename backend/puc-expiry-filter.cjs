const FILTERS = new Set(['all', 'expiry', 'expired', 'due10', 'due7', 'due15', 'due30', 'due_custom']);

function expiryFilter(filter = 'all', month = '', now = new Date(), customDays = null) {
  if (!FILTERS.has(filter)) throw Error('Choose a valid customer option.');
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  let from = null, to = null;

  if (filter === 'expired') {
    to = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
  } else if (filter === 'due10') {
    from = today;
    to = new Date(Date.parse(today) + 10 * 86400000).toISOString().slice(0, 10);
  } else if (filter === 'due7') {
    from = today;
    to = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10);
  } else if (filter === 'due15') {
    from = today;
    to = new Date(Date.parse(today) + 15 * 86400000).toISOString().slice(0, 10);
  } else if (filter === 'due30') {
    from = today;
    to = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10);
  } else if (filter === 'due_custom') {
    const days = Number.isInteger(customDays) ? customDays : parseInt(customDays, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      throw Error('Enter a valid custom day horizon between 1 and 365 days.');
    }
    from = today;
    to = new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
  }

  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Choose a valid expiry month.');
    const first = month + '-01';
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    from = from && from > first ? from : first;
    to = to && to < last ? to : last;
  }

  return { from, to, empty: !!(from && to && from > to), sortByExpiry: filter !== 'all' || !!month };
}

module.exports = { expiryFilter };
