import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Pencil, Search, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { apiFetch, queryString } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, PaginationBar } from '../components/Common';
import type { Pagination, Product, UserProfile } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useToast } from '../toast';

type ProductsResponse = { products: Product[]; pagination: Pagination };

export function Products({ user }: { user: UserProfile }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [active, setActive] = useState(true);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => setPage(1), [deferredSearch]);
  const products = useQuery({
    queryKey: ['products', page, deferredSearch],
    queryFn: ({ signal }) => apiFetch<ProductsResponse>(`/api/products?${queryString({ page, pageSize: 16, search: deferredSearch })}`, { signal }),
    placeholderData: (previous) => previous,
  });

  function reset() {
    setFormOpen(false); setEditing(null); setName(''); setDescription(''); setPrice(''); setActive(true);
  }
  function edit(product: Product) {
    setEditing(product); setName(product.name); setDescription(product.description); setPrice(String(product.price)); setActive(product.active); setFormOpen(true);
  }
  const save = useMutation({
    mutationFn: () => apiFetch(editing ? `/api/products/${editing.id}` : '/api/products', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify({ name, description, price: Number(price), active }),
    }),
    onSuccess() { showToast(editing ? 'Product updated' : 'Product added'); reset(); void queryClient.invalidateQueries({ queryKey: ['products'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });
  const archive = useMutation({
    mutationFn: (product: Product) => apiFetch(`/api/products/${product.id}`, { method: 'DELETE' }),
    onSuccess() { showToast('Product hidden from WhatsApp'); void queryClient.invalidateQueries({ queryKey: ['products'] }); },
    onError(error) { showToast(error.message, 'error'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return showToast('Enter a product name', 'error');
    if (!price || Number(price) < 0) return showToast('Enter a valid price', 'error');
    save.mutate();
  }

  return <>
    <PageHeader title="Product catalogue" subtitle={user.role === 'merchant' ? 'Products customers can choose in the Affiliate AE WhatsApp chat.' : 'Merchant WhatsApp product catalogues.'} actions={
      user.role === 'merchant' ? <button className="button primary" onClick={() => { reset(); setFormOpen(true); }}><PackagePlus size={16} />Add product</button> : undefined
    } />
    {formOpen ? <section className="panel product-form-panel">
      <div className="form-heading"><div><h2>{editing ? 'Edit product' : 'Add product'}</h2><p>Active products are available immediately in WhatsApp.</p></div><button className="icon-button" title="Close" onClick={reset}><X /></button></div>
      <form onSubmit={submit} className="product-form-grid">
        <label>Product name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
        <label>Price (INR)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        <label className="product-description">Description (optional)<textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></label>
        {editing ? <label className="product-active"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Show this product in WhatsApp</label> : null}
        <div className="form-actions"><button className="button primary" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save product'}</button><button type="button" className="button secondary" onClick={reset}>Cancel</button></div>
      </form>
    </section> : null}
    <section className="panel">
      <div className="list-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products" /></label></div>
      {products.isPending ? <LoadingState /> : products.isError ? <ErrorState error={products.error} retry={() => products.refetch()} /> : !products.data?.products.length ? <EmptyState>No products yet.</EmptyState> : <>
        <div className="table-scroll"><table><thead><tr><th>Product</th>{user.role === 'admin' ? <th>Merchant</th> : null}<th>Price</th><th>Availability</th><th>Updated</th>{user.role === 'merchant' ? <th /> : null}</tr></thead><tbody>
          {products.data.products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.description || 'No description'}</small></td>{user.role === 'admin' ? <td>{product.merchant}</td> : null}<td className="amount-column"><strong>{formatCurrency(product.price)}</strong></td><td><span className={`tag ${product.active ? 'success' : 'muted'}`}>{product.active ? 'Active' : 'Hidden'}</span></td><td>{formatDate(product.updatedAt)}</td>{user.role === 'merchant' ? <td><div className="table-actions"><button className="icon-button" title="Edit product" onClick={() => edit(product)}><Pencil size={16} /></button>{product.active ? <button className="icon-button" title="Hide product" onClick={() => archive.mutate(product)}><ToggleRight size={18} /></button> : <button className="icon-button" title="Edit product" onClick={() => edit(product)}><ToggleLeft size={18} /></button>}</div></td> : null}</tr>)}
        </tbody></table></div>
        <PaginationBar pagination={products.data.pagination} onPage={setPage} />
      </>}
    </section>
  </>;
}
