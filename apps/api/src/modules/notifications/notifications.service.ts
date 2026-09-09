/**
 * Serviço de notificações in-app.
 * Função utilitária `notify()` pode ser chamada de qualquer outro módulo.
 */

import { prisma } from '@kairos-crm/database';
import { logger } from '../../lib/logger';

export type NotificationType =
  | 'NEW_LEAD'
  | 'NEW_CONVERSATION'
  | 'NEW_MESSAGE'
  | 'TASK_ASSIGNED'
  | 'FOLLOWUP_DUE'
  | 'AUTOMATION_RUN'
  | 'CONVERSATION_TAKEOVER'
  | 'CONVERSATION_CLOSED'
  | 'MENTION';

export interface NotifyInput {
  tenantId: string;
  userId: string;     // destinatário (1+). Pra múltiplos, chama notify() várias vezes
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  icon?: string;
  metadata?: any;
}

export async function notify(input: NotifyInput) {
  try {
    return await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        icon: input.icon,
        metadata: input.metadata || {},
      },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, input }, 'falha ao criar notificação');
    return null;
  }
}

/** Notifica TODOS admins/agents do tenant (exceto o ator). */
export async function notifyTenantStaff(opts: {
  tenantId: string;
  excludeUserId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  icon?: string;
  metadata?: any;
}) {
  const users = await prisma.user.findMany({
    where: {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      role: { in: ['TENANT_ADMIN', 'MANAGER', 'AGENT'] },
      ...(opts.excludeUserId ? { NOT: { id: opts.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  for (const u of users) {
    await notify({
      tenantId: opts.tenantId,
      userId: u.id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      link: opts.link,
      icon: opts.icon,
      metadata: opts.metadata,
    });
  }
}
