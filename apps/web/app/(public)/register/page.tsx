'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, Mail, Lock, User, Phone, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetch, ApiClientError } from '@/lib/api';
import { slugify } from '@/lib/utils';
import type { LoginResponse } from '@kairos-crm/shared';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    tenantEmail: '',
    tenantPhone: '',
    name: '',
    email: '',
    password: '',
    accept: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = form.tenantSlug || (form.tenantName ? slugify(form.tenantName) : 'minha-empresa');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<LoginResponse>('/api/auth/register', {
        method: 'POST',
        body: {
          tenantName: form.tenantName,
          tenantSlug: form.tenantSlug || slugify(form.tenantName),
          tenantEmail: form.tenantEmail,
          tenantPhone: form.tenantPhone || undefined,
          name: form.name,
          email: form.email,
          password: form.password,
        },
      });
      const maxAge = 60 * 60 * 24 * 7;
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

  // Indicador de força da senha
  const strength = (() => {
    const p = form.password;
    if (!p) return { score: 0, label: '—', color: 'bg-ink-800' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const map = [
      { label: 'Muito fraca', color: 'bg-red-500' },
      { label: 'Fraca', color: 'bg-red-500' },
      { label: 'Razoável', color: 'bg-amber-500' },
      { label: 'Boa', color: 'bg-kairos-500' },
      { label: 'Forte', color: 'bg-kairos-400' },
      { label: 'Excelente', color: 'bg-kairos-300' },
    ];
    return { score, ...map[score] };
  })();

  return (
    <>
      <Background />
      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Brand side */}
        <div className="relative hidden flex-col justify-between p-12 lg:flex">
          <Logo size="lg" />
          <div>
            <h2 className="font-display text-4xl font-bold leading-tight text-ink-50">
              14 dias grátis.<br />
              <span className="text-gradient-kairos">Sem cartão, sem surpresa.</span>
            </h2>
            <p className="mt-4 max-w-md text-base text-ink-400">
              Você cria sua empresa, configura o WhatsApp e o Hermes no seu tom, e começa a receber leads hoje.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Tudo liberado no trial — sem limitação esquisita',
                'Suporte humano em português',
                'Cancele a qualquer momento, exporte seus dados',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-ink-300">
                  <Check className="mt-0.5 h-4 w-4 text-kairos-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-600">Construído com Hermes, Next.js, Fastify e Prisma.</p>
        </div>

        {/* Form side */}
        <div className="flex items-center justify-center p-6 py-12 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-lg"
          >
            <div className="mb-8 lg:hidden">
              <Logo size="md" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink-50">Criar conta</h1>
            <p className="mt-1.5 text-sm text-ink-400">Você será o primeiro admin do seu tenant.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-4">
                <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Sua empresa
                </div>
                <Input
                  label="Nome da empresa"
                  name="tenantName"
                  placeholder="Salão Bela Vida"
                  value={form.tenantName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, tenantName: v, tenantSlug: f.tenantSlug || slugify(v) }));
                  }}
                  required
                  leftIcon={<Building2 className="h-4 w-4" />}
                />
                <div>
                  <Input
                    label="Slug (URL)"
                    name="tenantSlug"
                    placeholder="salao-bela-vida"
                    value={form.tenantSlug}
                    onChange={(e) => setForm({ ...form, tenantSlug: slugify(e.target.value) })}
                    required
                    leftIcon={<span className="text-2xs font-medium text-ink-500">.crm/</span>}
                    helper={`Seu tenant: ${slugPreview}`}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Email da empresa"
                    name="tenantEmail"
                    type="email"
                    placeholder="contato@salao.com"
                    value={form.tenantEmail}
                    onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })}
                    required
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                  <Input
                    label="Telefone (opcional)"
                    name="tenantPhone"
                    placeholder="(11) 99999-0000"
                    value={form.tenantPhone}
                    onChange={(e) => setForm({ ...form, tenantPhone: e.target.value })}
                    leftIcon={<Phone className="h-4 w-4" />}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t border-ink-800 pt-5">
                <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Seu acesso (admin)
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Seu nome"
                    name="name"
                    placeholder="Maria Silva"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    leftIcon={<User className="h-4 w-4" />}
                  />
                  <Input
                    label="Seu email"
                    name="email"
                    type="email"
                    placeholder="maria@salao.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </div>
                <div>
                  <Input
                    label="Senha"
                    name="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                    leftIcon={<Lock className="h-4 w-4" />}
                    helper="Use maiúscula, minúscula, número e símbolo."
                  />
                  {form.password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className={`h-full transition-all ${strength.color}`}
                          style={{ width: `${(strength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-2xs font-medium text-ink-500">{strength.label}</span>
                    </div>
                  )}
                </div>
              </div>

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
                {loading ? 'Criando conta...' : 'Criar conta grátis'} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-ink-400">
              Já tem conta?{' '}
              <Link href="/login" className="font-medium text-kairos-400 hover:text-kairos-300">
                Entrar
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}
