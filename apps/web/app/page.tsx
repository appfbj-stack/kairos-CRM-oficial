import Link from 'next/link';
import {
  Sparkles,
  Users,
  MessageSquare,
  BarChart3,
  KanbanSquare,
  Bot,
  Check,
  ArrowRight,
  Shield,
  Zap,
  Layers,
  Star,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Background } from '@/components/ui/Background';
import { Badge } from '@/components/ui/AnimatedNumber';

const features = [
  {
    icon: Users,
    title: 'Leads e Clientes',
    desc: 'Centralize contatos, empresas e oportunidades. Tags, notas, histórico e busca em tempo real.',
  },
  {
    icon: KanbanSquare,
    title: 'Funis Kanban',
    desc: 'Funis customizáveis com drag-and-drop. Cada tenant com seu próprio fluxo de vendas.',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp multi-provider',
    desc: 'Inbox compartilhada. Evolution, Uazapi ou seu provider. Webhook roteado por tenant automaticamente.',
  },
  {
    icon: Bot,
    title: 'Kairos IA — IA Nativa',
    desc: 'Um único agente orquestrador para todos os tenants. Personalidade e ferramentas por empresa.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard e Métricas',
    desc: 'Conversão, performance, follow-ups, agendamentos. Tudo filtrado automaticamente por tenant.',
  },
  {
    icon: Layers,
    title: 'RAG por tenant',
    desc: 'Base de conhecimento isolada. PDFs, FAQs, políticas. A Kairos IA só vê o que é do tenant atual.',
  },
];

const logos = ['Salão Bela', 'Solar Pro', 'Oficina 21', 'ImobPlus', 'Clínica Vida', 'PetShop+'];

const pricing = [
  {
    name: 'Trial',
    price: 'R$ 0',
    period: '14 dias',
    desc: 'Tudo liberado pra você experimentar.',
    cta: 'Começar grátis',
    href: '/register',
    features: ['Até 3 usuários', '500 contatos', 'WhatsApp (1 instância)', 'Kairos IA (100 msgs/mês)'],
  },
  {
    name: 'Pro',
    price: 'R$ 197',
    period: '/mês',
    desc: 'Para times vendendo todo dia.',
    cta: 'Assinar Pro',
    href: '/register',
    highlight: true,
    features: ['Até 15 usuários', 'Contatos ilimitados', 'WhatsApp (3 instâncias)', 'Kairos IA (5.000 msgs/mês)', 'Automações visuais', 'RAG com 1 GB'],
  },
  {
    name: 'Enterprise',
    price: 'Fale',
    period: 'com a gente',
    desc: 'White-label, SLA, suporte dedicado.',
    cta: 'Falar com vendas',
    href: '/register',
    features: ['Usuários ilimitados', 'White-label completo', 'WhatsApp ilimitado', 'Kairos IA sem limite', 'Onboarding 1-a-1', 'SLA 99,9%'],
  },
];

export default function HomePage() {
  return (
    <>
      <Background />
      <main className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-ink-800/60 bg-ink-950/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              <a href="#features" className="btn-ghost">Recursos</a>
              <a href="#how" className="btn-ghost">Como funciona</a>
              <a href="#pricing" className="btn-ghost">Preços</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-ghost">Entrar</Link>
              <Link href="/register" className="btn-primary">
                Criar conta <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative px-6 pt-20 pb-24 sm:pt-28">
          <div className="mx-auto max-w-5xl text-center">
            <Badge variant="kairos" pulse>
              <Sparkles className="h-3 w-3" />
              Multi-tenant · IA central · WhatsApp nativo
            </Badge>
            <h1 className="mt-6 font-display text-5xl font-extrabold tracking-tight text-ink-50 sm:text-6xl lg:text-7xl">
              O CRM que <span className="text-gradient-kairos">vende por você</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-400 sm:text-xl">
              Funis Kanban, WhatsApp multi-provider, IA que entende seu negócio, automações visuais e
              follow-up inteligente. Um sistema, dezenas de empresas.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary-lg">
                Começar grátis (14 dias) <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="btn-ghost px-6 py-3 text-base">Ver demonstração</a>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              Sem cartão · Cancele quando quiser · Suporte em português
            </p>
          </div>

          {/* Mockup card */}
          <div className="relative mx-auto mt-16 max-w-6xl">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-kairos-500/20 via-emerald-500/20 to-kairos-500/20 blur-3xl" />
            <div className="relative card-elevated overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-ink-800/80 bg-ink-950/60 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-xs text-ink-500">crm.fbautomacao.space/dashboard</span>
              </div>
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[200px_1fr]">
                <aside className="hidden border-r border-ink-800/80 bg-ink-950/40 p-4 lg:block">
                  <div className="space-y-1.5">
                    {['Dashboard', 'Conversas', 'Leads', 'Funis', 'Kairos IA', 'Configurações'].map((item, i) => (
                      <div
                        key={item}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          i === 0 ? 'bg-kairos-500/10 text-kairos-300 ring-1 ring-kairos-500/20' : 'text-ink-400'
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Leads', v: '247' },
                      { label: 'Conversas', v: '38' },
                      { label: 'Vendas', v: 'R$ 18,4k' },
                    ].map((s) => (
                      <div key={s.label} className="card p-3">
                        <div className="text-2xs text-ink-500">{s.label}</div>
                        <div className="mt-1 text-xl font-bold text-ink-50">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {['Novo', 'Qualificado', 'Proposta', 'Ganho'].map((stage, i) => (
                      <div key={stage} className="card p-3">
                        <div className="text-2xs font-medium uppercase tracking-wide text-ink-500">
                          {stage}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {[1, 2, 3].slice(0, 3 - (i % 2)).map((j) => (
                            <div
                              key={j}
                              className="rounded-md bg-ink-800/60 p-2 text-2xs text-ink-400"
                            >
                              <div className="h-1.5 w-12 rounded bg-kairos-500/40" />
                              <div className="mt-1 h-1 w-8 rounded bg-ink-700" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Logos */}
        <section className="border-y border-ink-800/60 bg-ink-950/40 py-10">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-center text-2xs font-medium uppercase tracking-widest text-ink-500">
              Já usado por times que vendem em
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {logos.map((l) => (
                <div key={l} className="text-base font-semibold text-ink-600">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="kairos">Recursos</Badge>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
                Tudo que você precisa.<br />
                <span className="text-gradient-kairos">Nada que você não precisa.</span>
              </h2>
              <p className="mt-4 text-lg text-ink-400">
                Construído com a mesma base que vende pra salão, oficina, clínica e igreja.
                O que muda é a configuração — não o sistema.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="card-hover p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-kairos-500/10 text-kairos-400 ring-1 ring-kairos-500/20">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink-100">{f.title}</h3>
                  <p className="mt-2 text-sm text-ink-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="amber">Como funciona</Badge>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
                Da conversa ao fechamento,<br />tudo no mesmo lugar.
              </h2>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-4">
              {[
                { num: '01', title: 'Lead chega', desc: 'WhatsApp, formulário, importação ou API.' },
                { num: '02', title: 'IA qualifica', desc: 'Kairos IA responde, identifica interesse, enriquece o lead.' },
                { num: '03', title: 'Funil avança', desc: 'Drag-and-drop pelo Kanban. Automações disparam follow-ups.' },
                { num: '04', title: 'Venda fecha', desc: 'Orçamento no WhatsApp, aprovação, contrato e dashboard.' },
              ].map((s) => (
                <div key={s.num} className="card p-6">
                  <div className="font-mono text-xs text-kairos-400">{s.num}</div>
                  <h3 className="mt-3 text-base font-semibold text-ink-100">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="card-elevated overflow-hidden p-8 sm:p-12">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <Badge variant="kairos">
                    <Shield className="h-3 w-3" />
                    Multi-tenant seguro
                  </Badge>
                  <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl">
                    Isolamento total entre empresas.
                  </h2>
                  <p className="mt-3 text-base text-ink-400">
                    Cada cliente vê só os seus dados — mesmo se outro tenant for invadido.
                    Row Level Security no PostgreSQL + tenant_id extraído do JWT (nunca do frontend).
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {[
                      'JWT com rotação de refresh tokens',
                      'Audit log de toda ação sensível',
                      'Senhas com bcrypt (12 rounds)',
                      'Helmet + CORS + Rate limiting',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-ink-300">
                        <Check className="mt-0.5 h-4 w-4 text-kairos-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden lg:block">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-kairos-500/20 blur-2xl" />
                    <div className="relative card p-6">
                      <div className="space-y-3 font-mono text-2xs">
                        <div className="text-ink-500">POST /api/auth/login</div>
                        <div className="text-ink-300">→ 200 OK</div>
                        <div className="text-ink-500">accessToken: eyJhbGciOi...</div>
                        <div className="text-ink-500">tenantId: 7a3b...</div>
                        <div className="text-ink-500">role: TENANT_ADMIN</div>
                        <div className="mt-3 text-ink-500">GET /api/users</div>
                        <div className="text-ink-300">→ where: tenantId = 7a3b...</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="kairos">Preços</Badge>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
                Preço justo. Sem surpresas.
              </h2>
              <p className="mt-4 text-lg text-ink-400">
                Você paga por tenant, não por usuário. Inclui WhatsApp e IA.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {pricing.map((p) => (
                <div
                  key={p.name}
                  className={
                    p.highlight
                      ? 'card-elevated relative p-6 ring-2 ring-kairos-500/40 shadow-glow'
                      : 'card p-6'
                  }
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="kairos">
                        <Star className="h-3 w-3" /> Mais popular
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-semibold text-ink-100">{p.name}</h3>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-ink-50">{p.price}</span>
                    <span className="text-sm text-ink-500">{p.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-400">{p.desc}</p>
                  <Link
                    href={p.href}
                    className={p.highlight ? 'btn-primary mt-6 w-full' : 'btn-outline mt-6 w-full'}
                  >
                    {p.cta}
                  </Link>
                  <ul className="mt-6 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink-300">
                        <Check className="mt-0.5 h-4 w-4 text-kairos-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kairos-500 to-emerald-600 p-12 text-center shadow-glow-lg">
              <div className="absolute inset-0 bg-grid-pattern bg-[size:32px_32px] opacity-20" />
              <div className="relative">
                <Zap className="mx-auto h-8 w-8 text-ink-950" />
                <h2 className="mt-4 font-display text-3xl font-bold text-ink-950 sm:text-4xl">
                  Comece em 30 segundos.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-base text-ink-900/80">
                  Sem cartão. Sem instalar nada. Crie seu tenant e veja o Kairos funcionando.
                </p>
                <Link
                  href="/register"
                  className="mt-8 inline-flex items-center gap-2 rounded-lg bg-ink-950 px-6 py-3 text-base font-semibold text-ink-50 transition hover:bg-ink-900"
                >
                  Criar minha conta <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-ink-800/60 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
            <Logo size="sm" />
            <p className="text-xs text-ink-500">
              © {new Date().getFullYear()} Kairos CRM. Construído com Kairos IA, Next.js, Fastify e Prisma.
            </p>
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Link href="/login" className="hover:text-ink-300">Entrar</Link>
              <span>·</span>
              <Link href="/register" className="hover:text-ink-300">Criar conta</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
