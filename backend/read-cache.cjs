// Instance-local, bounded cache for non-personal read results only.
function createReadCache({ ttlMs, maxEntries = 1000, cacheable = () => true, now = Date.now }) {
  const entries = new Map();
  return {
    delete(key) { entries.delete(key); },
    async get(key, load) {
      const existing = entries.get(key);
      if (existing && (existing.pending || existing.expires > now())) return existing.promise;
      entries.delete(key);
      while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      const entry = { pending: true, expires: 0 };
      entry.promise = Promise.resolve().then(load).then(value => {
        entry.pending = false;
        entry.expires = now() + ttlMs;
        if (!cacheable(value) && entries.get(key) === entry) entries.delete(key);
        return value;
      }, error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.set(key, entry);
      return entry.promise;
    },
  };
}
module.exports = { createReadCache };
