import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

type GreetingConfig = { messages: string[]; rotationStart: string };
const validConfig = (value: unknown): value is GreetingConfig => {
  const config = value as GreetingConfig | null;
  return !!config && Array.isArray(config.messages) && config.messages.length > 0
    && config.messages.every(message => typeof message === 'string' && message.trim().length > 0)
    && /^\d{4}-\d{2}-\d{2}$/.test(config.rotationStart)
    && Number.isFinite(Date.parse(`${config.rotationStart}T00:00:00Z`));
};

export function dailyMessage(config: GreetingConfig, now = Date.now()) {
  const day = Math.floor((now + 330 * 60_000) / 86_400_000);
  const firstDay = Math.floor(Date.parse(`${config.rotationStart}T00:00:00Z`) / 86_400_000);
  return config.messages[((day - firstDay) % config.messages.length + config.messages.length) % config.messages.length];
}

export function useDailyGreeting(role: 'customer' | 'merchant') {
  const cacheKey = `ae-daily-greetings-${role}`;
  const [now, setNow] = useState(Date.now);
  const { data } = useQuery({
    queryKey: ['daily-greetings', role],
    queryFn: async () => {
      const config = await apiFetch<GreetingConfig>(`/api/daily-greetings?role=${role}`);
      if (!validConfig(config)) throw new Error('Invalid daily greeting configuration');
      try { localStorage.setItem(cacheKey, JSON.stringify(config)); } catch { /* Storage may be unavailable. */ }
      return config;
    },
    initialData: () => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        return validConfig(saved) ? saved : undefined;
      } catch { return undefined; }
    },
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return data ? dailyMessage(data, now) : role === 'customer'
    ? 'Your neighbourhood. Your businesses. Your AE.'
    : 'Build relationships, not just transactions.';
}
