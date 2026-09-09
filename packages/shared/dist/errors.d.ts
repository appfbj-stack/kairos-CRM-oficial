/**
 * Erros padronizados do Kairos CRM.
 * Backend converte em HTTP status code.
 * Frontend recebe { error: { code, message } }.
 */
export type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TENANT_MISMATCH' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly details?: unknown;
    constructor(code: ErrorCode, message: string, statusCode: number, details?: unknown);
    static validation(message?: string, details?: unknown): AppError;
    static badRequest(message?: string, details?: unknown): AppError;
    static unauthenticated(message?: string): AppError;
    static forbidden(message?: string): AppError;
    static notFound(resource?: string): AppError;
    static conflict(message: string): AppError;
    static tenantMismatch(message?: string): AppError;
    static rateLimited(message?: string): AppError;
    static internal(message?: string): AppError;
}
export interface ErrorResponse {
    error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
    };
}
