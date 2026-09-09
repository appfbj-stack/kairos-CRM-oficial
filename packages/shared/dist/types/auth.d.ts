import type { UserRole } from './roles';
export interface AuthPayload {
    sub: string;
    email: string;
    tenantId: string | null;
    role: UserRole;
    iat?: number;
    exp?: number;
}
export interface AccessTokenPayload extends AuthPayload {
    type: 'access';
}
export interface RefreshTokenPayload {
    sub: string;
    type: 'refresh';
    jti: string;
    iat?: number;
    exp?: number;
}
export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenantId: string | null;
    tenantSlug?: string | null;
}
export interface LoginResponse {
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
