import { z } from 'zod';
export declare const slugSchema: z.ZodString;
export declare const emailSchema: z.ZodString;
export declare const passwordSchema: z.ZodString;
export declare const registerSchema: z.ZodObject<{
    tenantName: z.ZodString;
    tenantSlug: z.ZodString;
    tenantEmail: z.ZodString;
    tenantPhone: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantName: string;
    tenantSlug: string;
    tenantEmail: string;
    name: string;
    email: string;
    password: string;
    tenantPhone?: string | undefined;
}, {
    tenantName: string;
    tenantSlug: string;
    tenantEmail: string;
    name: string;
    email: string;
    password: string;
    tenantPhone?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    tenantSlug: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    tenantSlug?: string | undefined;
}, {
    email: string;
    password: string;
    tenantSlug?: string | undefined;
}>;
export declare const refreshSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
