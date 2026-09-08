import { redirect } from 'next/navigation';
import { getAccessToken, meRequest } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { TasksBoard, type Task } from '@/components/tasks/board';

export default async function TasksPage() {
  const token = getAccessToken();
  if (!token) redirect('/login');
  const me = await meRequest(token);
  if (!me.tenantId) {
    return <div className="card p-10 text-center text-slate-300">Super Admin: gerencie tarefas via tenants.</div>;
  }

  const resp = await apiFetch<{ data: any[] }>('/api/crm/tasks?limit=200', { accessToken: token }).catch(() => ({ data: [] }));
  const tasks: Task[] = resp.data as any;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-50">Tarefas</h1>
        <p className="mt-0.5 text-sm text-ink-400">Organize seu trabalho por status e prioridade.</p>
      </div>
      <TasksBoard initial={tasks} />
    </div>
  );
}
