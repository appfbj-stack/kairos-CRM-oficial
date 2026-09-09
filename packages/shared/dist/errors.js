"use strict";
/**
 * Erros padronizados do Kairos CRM.
 * Backend converte em HTTP status code.
 * Frontend recebe { error: { code, message } }.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode, details) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
    static validation(message = 'Dados inválidos', details) {
        return new AppError('VALIDATION_ERROR', message, 400, details);
    }
    static badRequest(message = 'Requisição inválida', details) {
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
    static conflict(message) {
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
exports.AppError = AppError;
