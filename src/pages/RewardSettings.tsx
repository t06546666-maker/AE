import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeIndianRupee, MessageCircle, Save } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import type { RewardSettings, UserProfile } from '../types';
import { ALL_REWARD_OPTIONS, formatPoints } from '../utils';
import { useToast } from '../toast';

export function RewardSettingsPage({ user }: { user: UserProfile }) {
  const queryClient = useQueryClient(); const { showToast } = useToast();
  const settings = useQuery({ queryKey: ['reward-settings'], queryFn: ({ signal }) => apiFetch<RewardSettings>('/api/settings/reward', { signal }) });
  const [minimum, setMinimum] = useState(0.5); const [defaultPercentage, setDefaultPercentage] = useState(1);
  useEffect(() => { if (settings.data) { setMinimum(settings.data.rewardMinimum); setDefaultPercentage(settings.data.rewardPercentage); } }, [settings.data]);
  const save = useMutation({ mutationFn: () => apiFetch<RewardSettings>('/api/settings/reward', { method: 'PUT', body: JSON.stringify({ rewardMinimum: minimum, rewardPercentage: defaultPercentage }) }), onSuccess(data) { queryClient.setQueryData(['reward-settings'], data); showToast('Reward settings saved'); }, onError(error) { showToast(error.message, 'error'); } });
  function changeMinimum(value: number) { setMinimum(value); if (defaultPercentage < value) setDefaultPercentage(value); }
  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState error={settings.error} retry={() => settings.refetch()} />;
  return <><PageHeader title="Reward Settings" subtitle="Set the minimum and default percentage available at checkout." /><section className="panel settings-panel"><div className="panel-heading"><div><h2>Reward percentage rules</h2><p>Maximum reward remains fixed at 10%.</p></div><BadgeIndianRupee /></div>{user.role === 'admin' ? <><div className="settings-fields"><label>Minimum percentage<select value={minimum} onChange={(event) => changeMinimum(Number(event.target.value))}>{ALL_REWARD_OPTIONS.map((option) => <option key={option} value={option}>{option}%</option>)}</select></label><label>Default percentage<select value={defaultPercentage} onChange={(event) => setDefaultPercentage(Number(event.target.value))}>{ALL_REWARD_OPTIONS.filter((option) => option >= minimum).map((option) => <option key={option} value={option}>{option}%</option>)}</select></label><div className="settings-example"><span>Example at ₹2,500</span><strong>{formatPoints(2500 * defaultPercentage / 100)} points</strong></div></div><button className="button primary" disabled={save.isPending} onClick={() => save.mutate()}><Save size={16} />{save.isPending ? 'Saving' : 'Save settings'}</button></> : <div className="merchant-setting"><strong>{defaultPercentage}%</strong><span>Default percentage · minimum {minimum}%</span></div>}</section><section className="panel"><div className="panel-heading"><div><h2>WhatsApp reward receipt</h2><p>After QR checkout, the customer receives the merchant, order amount, percentage, points earned, and total balance through the approved template.</p></div><MessageCircle /></div></section></>;
}
