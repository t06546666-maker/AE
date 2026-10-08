import { MapPin, RefreshCw } from 'lucide-react';
import { useCustomerLocation } from '../hooks/useCustomerLocation';

export function CustomerLocationBar() {
  const location = useCustomerLocation();
  return <section className="mx-4 my-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-gray-900" aria-label="Current location">
    <div className="flex items-center gap-2"><MapPin size={20} className="shrink-0 text-blue-600"/><div className="min-w-0 flex-1"><p className="text-xs text-gray-600">Your current location</p><p className="text-sm font-semibold" aria-live="polite">{location.isFetching ? 'Finding your location…' : location.data?.area || 'Enable location for nearby shops'}</p></div><button type="button" aria-label="Refresh current location" disabled={location.isFetching} onClick={() => void location.refetch()} className="p-2 text-blue-600"><RefreshCw size={18}/></button></div>
    <p className="mt-1 text-xs text-gray-600">{location.error ? location.error.message : 'GPS is used to find shops near you. No background tracking.'}</p>
  </section>;
}
