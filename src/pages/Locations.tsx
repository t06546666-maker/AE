import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Common';
import { formatDate } from '../utils';
import { useToast } from '../toast';

interface Network {
  id: string;
  code: string;
  name: string;
  currency: string;
  reward_rate_bps: number;
  min_redemption_threshold_paise: number;
  created_at: string;
}

export function Locations() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  
  const networks = useQuery({
    queryKey: ['networks'],
    queryFn: ({ signal }) => apiFetch<{ networks: Network[] }>('/api/networks', { signal }),
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/api/networks', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim() })
    }),
    onSuccess() {
      setCode('');
      setName('');
      showToast('Location created successfully');
      void queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
    onError(error) {
      showToast(error.message, 'error');
    }
  });

  const remove = useMutation({
    mutationFn: (network: Network) => apiFetch(`/api/networks/${network.id}`, { method: 'DELETE' }),
    onSuccess() {
      showToast('Location removed');
      void queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
    onError(error) {
      showToast(error.message, 'error');
    }
  });

  function deleteNetwork(network: Network) {
    if (window.confirm(`Remove ${network.code}? This action cannot be undone.`)) {
      remove.mutate(network);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <PageHeader title="Locations" subtitle="Manage network locations and codes." />
      
      <form className="panel" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <h2>Add Location</h2>
            <p>Create a new location code to assign merchants to.</p>
          </div>
          <MapPin />
        </div>
        <div className="two-column-form">
          <label>
            Location Code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. PALAKKAD-001"
              required
            />
          </label>
          <label>
            Location Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Palakkad Main"
              required
            />
          </label>
        </div>
        <button className="button primary" disabled={create.isPending}>
          <Plus size={16} />{create.isPending ? 'Creating...' : 'Add Location'}
        </button>
      </form>

      {networks.isPending ? (
        <LoadingState />
      ) : networks.isError ? (
        <ErrorState error={networks.error} retry={() => networks.refetch()} />
      ) : (
        <section className="table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Location Code</th>
                  <th>Location Name</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.data?.networks.map((network) => (
                  <tr key={network.id}>
                    <td><strong><Link to={`/locations/${network.id}`}>{network.code}</Link></strong></td>
                    <td>{network.name}</td>
                    <td>{formatDate(network.created_at)}</td>
                    <td>
                      <button className="icon-button danger-icon" title="Delete Location" onClick={() => deleteNetwork(network)}>
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!networks.data?.networks.length ? (
            <EmptyState>No locations found. Add one above.</EmptyState>
          ) : null}
        </section>
      )}
    </>
  );
}
