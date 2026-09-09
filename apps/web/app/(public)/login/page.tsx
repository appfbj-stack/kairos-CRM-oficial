'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Building2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetch, ApiClientError } from '@/lib/api';
import type { LoginResponse } from '@kairos-crm/shared';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', tenantSlug: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: {
          email: form.email,
          password: form.password,
          tenantSlug: form.tenantSlug || undefined,
        },
      });

      // Salva em cookies (não-httpOnly para que o server component consiga ler)
      // e também em localStorage (fallback pro client-side fetch)
      const maxAge = 60 * 60 * 24 * 7; // 7 dias
      const secure = window.location.protocol === 'https:';
      document.cookie = `kcrm_access=${res.accessToken}; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure ? '; Secure' : ''}`;
      document.cookie = `kcrm_refresh=${res.refreshToken}; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure ? '; Secure' : ''}`;
      localStorage.setItem('kcrm_access', res.accessToken);
      localStorage.setItem('kcrm_refresh', res.refreshToken);

      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.body.error.message);
      } else {
        setError('Erro de conexão com o servidor');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Background />
      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Coluna esquerda: brand */}
        <div className="relative hidden flex-col justify-between p-12 lg:flex">
          <Logo size="lg" />
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-display text-4xl font-bold leading-tight text-ink-50"
            >
              O CRM que <span className="text-gradient-kairos">vende por você</span>.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-4 max-w-md text-base text-ink-400"
            >
              Funis, WhatsApp, IA e automações. Um sistema, dezenas de empresas.
            </motion.p>
            <ul className="mt-8 space-y-3 text-sm text-ink-300">
              {[
                'Leads e clientes com histórico completo',
                'WhatsApp multi-provider com inbox compartilhada',
                'Hermes: IA central configurável por tenant',
                'Multi-tenant com isolamento total',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-kairos-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-600">
            Construído com Hermes, Next.js, Fastify e Prisma.
          </p>
        </div>

        {/* Coluna direita: form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 lg:hidden">
              <Logo size="md" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink-50">Entrar</h1>
            <p className="mt-1.5 text-sm text-ink-400">Acesse sua conta e seus clientes.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Input
                label="Slug do tenant"
                name="tenantSlug"
                placeholder="minha-empresa"
                helper="Apenas para Super Admin pode ficar em branco."
                value={form.tenantSlug}
                onChange={(e) => setForm({ ...form, tenantSlug: e.target.value.toLowerCase() })}
                autoComplete="off"
                leftIcon={<Building2 className="h-4 w-4" />}
              />
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="voce@empresa.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
                leftIcon={<Mail className="h-4 w-4" />}
              />
              <Input
                label="Senha"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
                leftIcon={<Lock className="h-4 w-4" />}
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <Button type="submit" loading={loading} size="lg" className="w-full">
                {loading ? 'Entrando...' : 'Entrar'} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-ink-400">
              Não tem conta?{' '}
              <Link href="/register" className="font-medium text-kairos-400 hover:text-kairos-300">
                Criar agora
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}
