# @kairos-crm/web

Frontend do Kairos CRM — Next.js 14 (App Router) + TypeScript + Tailwind.

## Rotas

- `/` — Landing page
- `/login` — Tela de login
- `/register` — Cadastro de nova empresa
- `/dashboard` — Dashboard autenticado (placeholder)
- `/conversations`, `/leads`, `/pipelines`, `/hermes`, `/settings` — Placeholders da Fase 2+

## Comandos

```bash
pnpm dev      # dev server em http://localhost:3000
pnpm build    # build para produção
pnpm start    # roda build
pnpm typecheck
```

## Auth

JWT armazenado em `localStorage` (`kcrm_access`, `kcrm_refresh`).
Em produção real, ideal migrar para httpOnly cookies (helpers já existem em `lib/auth.ts`).
