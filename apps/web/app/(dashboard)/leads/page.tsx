import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch, ApiClientError } from '@/lib/api';
import { KanbanBoard, type Lead, type Pipeline, type LeadStage } from '@/components/leads/kanban';

interface PipelineWithStages extends Pipeline {
  stages: LeadStage[];
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { pipeline?: string };
}) {
  const token = getAccessToken();
  if (!token) redirect('/login');

  const me = await meRequest(token);
  if (!me.tenantId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-300">Super Admin: visualize leads por tenant no painel admin.</p>
      </div>
    );
  }

  // Lista pipelines
  const pipelines: PipelineWithStages[] = await apiFetch<PipelineWithStages[]>('/api/crm/pipelines', {
    accessToken: token,
  }).catch(() => []);

  if (pipelines.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h2 className="text-lg font-semibold text-ink-100">Nenhum pipeline ainda</h2>
        <p className="mt-2 text-sm text-ink-400">
          Crie seu primeiro pipeline de vendas no botão abaixo.
        </p>
        <div className="mt-6 flex justify-center">
          <a href="/pipelines" className="btn-primary">Criar pipeline</a>
        </div>
      </div>
    );
  }

  // Pega o pipeline selecionado (via searchParam) ou o default
  const pipelineId = searchParams.pipeline || pipelines.find((p) => p.isDefault)?.id || pipelines[0].id;
  const pipeline = pipelines.find((p) => p.id === pipelineId) || pipelines[0];

  // Lista leads
  const leadsResp = await apiFetch<{ data: Lead[] }>(`/api/crm/leads?pipelineId=${pipeline.id}&limit=200`, {
    accessToken: token,
  }).catch(() => ({ data: [] as Lead[] }));

  return (
    <div className="space-y-4">
      {/* Header com seletor de pipeline */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">Leads</h1>
          <p className="mt-0.5 text-sm text-ink-400">
            {leadsResp.data.length} lead{leadsResp.data.length !== 1 ? 's' : ''} no pipeline <span className="text-kairos-400 font-medium">{pipeline.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 1 && (
            <select
              defaultValue={pipeline.id}
              className="input"
              onChange={(e) => {
                if (typeof window !== 'undefined') {
                  window.location.href = `/leads?pipeline=${e.target.value}`;
                }
              }}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isDefault && '★'}
                </option>
              ))}
            </select>
          )}
          <button className="btn-primary" disabled>
            + Novo lead
          </button>
        </div>
      </div>

      <KanbanBoard
        token={token}
        pipeline={pipeline}
        initialLeads={leadsResp.data}
      />
    </div>
  );
}
