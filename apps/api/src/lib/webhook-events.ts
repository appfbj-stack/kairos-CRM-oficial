/**
 * Catálogo de eventos publicados via webhook outbound.
 *
 * Apps externos se inscrevem em uma lista destes eventos por endpoint
 * (tabela WebhookEndpoint.events). O dispatcher publica apenas nos endpoints
 * inscritos naquele evento.
 *
 * Convenções de nome:
 *   - recurso.acao (ex: lead.created, message.received)
 *   - passado para "eventos já aconteceram"
 *   - presente seria incorreto
 */

export const WEBHOOK_EVENTS = [
  // CRM
  'lead.created',
  'lead.updated',
  'lead.stage_changed',
  'lead.won',
  'lead.lost',
  'lead.archived',

  'contact.created',
  'contact.updated',
  'contact.archived',

  // WhatsApp / conversas
  'conversation.created',
  'conversation.closed',
  'conversation.assigned',

  'message.received',     // inbound do cliente
  'message.sent',         // outbound (humano ou IA)
  'message.processed',    // IA terminou de processar mensagem recebida

  // Agendamentos / follow-ups
  'appointment.created',
  'appointment.confirmed',
  'appointment.cancelled',
  'appointment.done',
  'appointment.no_show',

  'followup.scheduled',
  'followup.sent',
  'followup.failed',

  // Automações
  'automation.triggered',

  // Orçamentos (futuro)
  'quote.created',
  'quote.accepted',
  'quote.rejected',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

/**
 * Helper: evento é válido?
 */
export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(event);
}

/**
 * Categorias (usadas pra rate limit/aggregação futura)
 */
export const EVENT_CATEGORIES = {
  crm: ['lead.created', 'lead.updated', 'lead.stage_changed', 'lead.won', 'lead.lost', 'lead.archived',
       'contact.created', 'contact.updated', 'contact.archived'],
  conversation: ['conversation.created', 'conversation.closed', 'conversation.assigned',
                 'message.received', 'message.sent', 'message.processed'],
  scheduling: ['appointment.created', 'appointment.confirmed', 'appointment.cancelled',
               'appointment.done', 'appointment.no_show',
               'followup.scheduled', 'followup.sent', 'followup.failed'],
  automation: ['automation.triggered'],
  quotes: ['quote.created', 'quote.accepted', 'quote.rejected'],
} as const;

export type EventCategory = keyof typeof EVENT_CATEGORIES;