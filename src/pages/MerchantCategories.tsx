import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../api';
import { ErrorState, LoadingState, PageHeader } from '../components/Common';
import { useToast } from '../toast';
import type { MerchantCategory } from '../types';

export function MerchantCategories() {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const categoriesQuery = useQuery({
    queryKey: ['merchant-categories'],
    queryFn: ({ signal }) => apiFetch<{ categories: MerchantCategory[] }>('/api/merchant-categories', { signal }),
  });

  const create = useMutation({
    mutationFn: () => apiFetch<{ category: MerchantCategory }>('/api/merchant-categories', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    }),
    onSuccess() {
      setName('');
      showToast('Category created');
      void queryClient.invalidateQueries({ queryKey: ['merchant-categories'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/merchant-categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess() {
      showToast('Category removed');
      void queryClient.invalidateQueries({ queryKey: ['merchant-categories'] });
    },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  }

  function deleteCategory(category: MerchantCategory) {
    if (window.confirm(`Delete category "${category.name}"? Merchants in this category will become uncategorized.`)) {
      remove.mutate(category.id);
    }
  }

  return (
    <>
      <PageHeader title="Merchant Categories" subtitle="Manage categories for shops and merchants to help customers find them." />
      
      <form className="panel" onSubmit={submit}>
        <div className="panel-heading">
          <div><h2>Add Category</h2><p>Create a new category for merchants.</p></div>
          <Plus />
        </div>
        <div className="flex gap-4 items-end px-6 pb-6">
          <label className="flex-1 m-0">Category Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Food, Retail, Health" required /></label>
          <button className="button primary" disabled={create.isPending}>
            <Plus size={16} />{create.isPending ? 'Adding...' : 'Add Category'}
          </button>
        </div>
      </form>

      {categoriesQuery.isPending ? <LoadingState label="Loading categories..." /> : categoriesQuery.isError ? (
        <ErrorState error={categoriesQuery.error} retry={() => categoriesQuery.refetch()} />
      ) : (
        <section className="table-panel">
          <div className="table-scroll">
            <table>
              <thead><tr><th>Category Name</th><th>Actions</th></tr></thead>
              <tbody>
                {categoriesQuery.data?.categories.map((category) => (
                  <tr key={category.id}>
                    <td><strong>{category.name}</strong></td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button danger-icon" title="Delete category" disabled={remove.isPending} onClick={() => deleteCategory(category)}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categoriesQuery.data?.categories.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-8 text-gray-500">No categories found. Add one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
