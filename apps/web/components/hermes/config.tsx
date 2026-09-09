'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, FlaskConical, Loader2, Power, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export interface AIConfig {
  id?: string;
  provider: 'OPENAI' | 'GEMINI' | 'CLAUDE' | 'DEEPSEEK' | 'GLM' | 'OLLAMA' | 'OPENROUTER';
  model: string | null;
  apiKey: string | null;
  baseUrl: string | null;
  assistantName: string;
  personality: string | null;
  objectives: string[];
  transferToHumanOn: string[];
  systemPrompt: string | null;
  temperature: number;
  enabled: boolean;
  autoReply: boolean;
  monthlyLimit: number | null;
  hasKey?: boolean;
}

const PROVIDERS: Record<string, { label: string; models: string[]; placeholder: string; freeModels?: string[] }> = {
  OPENAI: { label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], placeholder: 'sk-...' },
  GEMINI: { label: 'Google Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'], placeholder: 'AIza...' },
  CLAUDE: { label: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'], placeholder: 'sk-ant-...' },
  DEEPSEEK: { label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], placeholder: 'sk-...' },
  GLM: { label: 'Zhipu GLM', models: ['glm-4-plus', 'glm-4-flash'], placeholder: '...' },
  OLLAMA: { label: 'Ollama (local)', models: ['llama3.1', 'qwen2.5', 'mistral'], placeholder: 'qualquer (não é validado)' },
  OPENROUTER: {
    label: 'OpenRouter (todos os modelos)',
    placeholder: 'sk-or-v1-...',
    models: [
      // Pagos (curadoria)
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-exp',
      'deepseek/deepseek-chat',
    ],
    freeModels: [
      // Meta Llama
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'meta-llama/llama-3.1-405b-instruct:free',
      // Qwen
      'qwen/qwen-2.5-72b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'qwen/qwq-32b-preview:free',
      // Google
      'google/gemini-2.0-flash-exp:free',
      'google/gemma-2-9b-it:free',
      'google/gemma-2-27b-it:free',
      // DeepSeek
      'deepseek/deepseek-chat:free',
      'deepseek/deepseek-r1:free',
      // Mistral / Nous
      'mistralai/mistral-7b-instruct:free',
      'mistralai/mistral-small-3.2-24b-instruct:free',
      'nousresearch/hermes-3-llama-3.1-405b:free',
      'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
      // Microsoft
      'microsoft/phi-3-medium-128k-instruct:free',
      'microsoft/phi-3.5-mini-128k-instruct:free',
      // Outros
      'openchat/openchat-7b:free',
      'gryphe/mythomist-7b:free',
      'undi95/remm-slerp-l2-13b:free',
      'huggingfaceh4/zephyr-7b-beta:free',
    ],
  },
};

export function HermesConfig({ initial }: { initial: AIConfig | null }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<AIConfig>(initial || {
    provider: 'OPENAI',
    model: 'gpt-4o-mini',
    apiKey: '',
    baseUrl: null,
    assistantName: 'Kairos IA',
    personality: 'amigável, profissional e objetivo',
    objectives: ['atender', 'qualificar', 'agendar'],
    transferToHumanOn: ['reclamação', 'pedido de humano', 'pagamento'],
    systemPrompt: null,
    temperature: 0.7,
    enabled: true,
    autoReply: true,
    monthlyLimit: null,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; model?: string; error?: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const provider = PROVIDERS[cfg.provider];

  async function save() {
    setSaving(true);
    try {
      const body: any = { ...cfg };
      if (cfg.apiKey && !cfg.hasKey) {
        body.apiKey = cfg.apiKey;
      } else if (cfg.apiKey && cfg.apiKey.startsWith('••••')) {
        delete body.apiKey; // mantém o existente
      }
      const updated = await apiFetch<AIConfig>('/api/hermes/config', { method: 'PATCH', body });
      setCfg(updated);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await apiFetch<{ ok: boolean; model?: string; error?: string }>('/api/hermes/test', { method: 'POST' });
      setTestResult(r);
    } catch (err) {
      setTestResult({ ok: false, error: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-ink-50 flex items-center gap-2">
          <Power className="h-4 w-4 text-kairos-400" />
          Status
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
            Kairos IA habilitada
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" checked={cfg.autoReply} onChange={(e) => setCfg({ ...cfg, autoReply: e.target.checked })} />
            Responder automaticamente no WhatsApp
          </label>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-ink-50">Provider LLM</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Provider</label>
            <select
              className="input mt-1"
              value={cfg.provider}
              onChange={(e) => {
                const p = e.target.value as any;
                setCfg({ ...cfg, provider: p, model: PROVIDERS[p]?.models[0] || cfg.model });
              }}
            >
              {Object.entries(PROVIDERS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Modelo</label>
            {provider?.freeModels ? (
              <>
                <select
                  className="input mt-1 font-mono text-xs"
                  value={cfg.model || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') {
                      setCfg({ ...cfg, model: '' });
                    } else {
                      setCfg({ ...cfg, model: v });
                    }
                  }}
                >
                  <optgroup label="FREE (sem custo)">
                    {provider.freeModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Pagos">
                    {provider.models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                  <option value="__custom__">Outro (digitar)</option>
                </select>
                {(!cfg.model || !provider.freeModels.includes(cfg.model) && !provider.models.includes(cfg.model)) && (
                  <input
                    className="input mt-2 font-mono text-xs"
                    value={cfg.model || ''}
                    onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
                    placeholder="provider/modelo (ex: openai/gpt-4o-mini)"
                  />
                )}
              </>
            ) : (
              <>
                <select
                  className="input mt-1"
                  value={cfg.model || provider?.models[0]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') setCfg({ ...cfg, model: '' });
                    else setCfg({ ...cfg, model: v });
                  }}
                >
                  {provider?.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__custom__">Outro (digitar)</option>
                </select>
                {cfg.model && !provider?.models.includes(cfg.model) && (
                  <input
                    className="input mt-2 font-mono text-xs"
                    value={cfg.model || ''}
                    onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
                    placeholder="modelo custom"
                  />
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-3">
          <label className="text-2xs uppercase tracking-wider text-ink-500">API Key</label>
          <div className="relative mt-1">
            <input
              className="input pr-10 font-mono text-sm"
              type={showKey ? 'text' : 'password'}
              value={cfg.apiKey || ''}
              onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value, hasKey: false })}
              placeholder={provider?.placeholder}
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-500">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {cfg.hasKey && <p className="mt-1 text-2xs text-ink-500">Chave atual salva. Deixe vazio ou mude pra trocar.</p>}
        </div>
        {(cfg.provider === 'OLLAMA' || cfg.provider === 'OPENAI') && (
          <div className="mt-3">
            <label className="text-2xs uppercase tracking-wider text-ink-500">Base URL (opcional)</label>
            <input
              className="input mt-1 font-mono text-sm"
              value={cfg.baseUrl || ''}
              onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value || null })}
              placeholder={cfg.provider === 'OLLAMA' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button onClick={testConnection} disabled={testing} className="btn-secondary text-sm">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Testar conexão
          </button>
          {testResult && (
            <div className={`flex items-center gap-1.5 text-sm ${testResult.ok ? 'text-kairos-400' : 'text-red-400'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <span>✕</span>}
              {testResult.ok ? `Conectado em ${testResult.model}` : `Erro: ${testResult.error}`}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-ink-50">Personalidade</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Nome do assistente</label>
            <input className="input mt-1" value={cfg.assistantName} onChange={(e) => setCfg({ ...cfg, assistantName: e.target.value })} />
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Personalidade</label>
            <input className="input mt-1" value={cfg.personality || ''} onChange={(e) => setCfg({ ...cfg, personality: e.target.value })} placeholder="amigável, profissional e objetivo" />
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Objetivos (separados por vírgula)</label>
            <input
              className="input mt-1"
              value={cfg.objectives.join(', ')}
              onChange={(e) => setCfg({ ...cfg, objectives: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Transferir pra humano quando (separados por vírgula)</label>
            <input
              className="input mt-1"
              value={cfg.transferToHumanOn.join(', ')}
              onChange={(e) => setCfg({ ...cfg, transferToHumanOn: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-500">Temperatura (0–2)</label>
            <input
              type="number" min={0} max={2} step={0.1}
              className="input mt-1 w-24"
              value={cfg.temperature}
              onChange={(e) => setCfg({ ...cfg, temperature: parseFloat(e.target.value) || 0.7 })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
