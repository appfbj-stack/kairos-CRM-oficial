import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CatalogTable, type CatalogItem } from '@/components/catalog/table';

export default async function ServicesPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie serviços via tenants.</div>;
  }

  const resp = await apiFetch<{ data: any[] }>('/api/crm/services?limit=100', { accessToken: token }).catch(() => ({ data: [] }));
  const services: CatalogItem[] = resp.data as any;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Serviços</h1>
        <p className="mt-0.5 text-sm text-ink-400">{services.length} serviço{services.length !== 1 ? 's' : ''} cadastrado{services.length !== 1 ? 's' : ''}.</p>
      </div>
      <CatalogTable kind="service" initial={services} />
    </div>
  );
}
