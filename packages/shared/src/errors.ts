/**
 * Erros padronizados do Kairos CRM.
 * Backend converte em HTTP status code.
 * Frontend recebe { error: { code, message } }.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TENANT_MISMATCH'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static validation(message = 'Dados inválidos', details?: unknown) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }
  static badRequest(message = 'Requisição inválida', details?: unknown) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }
  static unauthenticated(message = 'Não autenticado') {
    return new AppError('UNAUTHENTICATED', message, 401);
  }
  static forbidden(message = 'Sem permissão') {
    return new AppError('FORBIDDEN', message, 403);
  }
  static notFound(resource = 'Recurso') {
    return new AppError('NOT_FOUND', `${resource} não encontrado`, 404);
  }
  static conflict(message: string) {
    return new AppError('CONFLICT', message, 409);
  }
  static tenantMismatch(message = 'Acesso negado a dados de outro tenant') {
    return new AppError('TENANT_MISMATCH', message, 403);
  }
  static rateLimited(message = 'Muitas requisições') {
    return new AppError('RATE_LIMITED', message, 429);
  }
  static internal(message = 'Erro interno do servidor') {
    return new AppError('INTERNAL_ERROR', message, 500);
  }
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
