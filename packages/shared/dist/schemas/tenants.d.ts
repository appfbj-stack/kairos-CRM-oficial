import { z } from 'zod';
export declare const tenantStatusSchema: z.ZodEnum<["ACTIVE", "SUSPENDED", "BLOCKED", "TRIAL"]>;
export declare const tenantPlanSchema: z.ZodEnum<["TRIAL", "STARTER", "PRO", "ENTERPRISE"]>;
export declare const createTenantSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    document: z.ZodOptional<z.ZodString>;
    plan: z.ZodDefault<z.ZodEnum<["TRIAL", "STARTER", "PRO", "ENTERPRISE"]>>;
    status: z.ZodDefault<z.ZodEnum<["ACTIVE", "SUSPENDED", "BLOCKED", "TRIAL"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    status: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "TRIAL";
    slug: string;
    plan: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
    phone?: string | undefined;
    document?: string | undefined;
}, {
    name: string;
    email: string;
    slug: string;
    status?: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "TRIAL" | undefined;
    phone?: string | undefined;
    document?: string | undefined;
    plan?: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
}>;
export declare const updateTenantSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    document: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    plan: z.ZodOptional<z.ZodDefault<z.ZodEnum<["TRIAL", "STARTER", "PRO", "ENTERPRISE"]>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["ACTIVE", "SUSPENDED", "BLOCKED", "TRIAL"]>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    status?: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "TRIAL" | undefined;
    slug?: string | undefined;
    phone?: string | undefined;
    document?: string | undefined;
    plan?: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    status?: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "TRIAL" | undefined;
    slug?: string | undefined;
    phone?: string | undefined;
    document?: string | undefined;
    plan?: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
}>;
export declare const tenantActionSchema: z.ZodObject<{
    action: z.ZodEnum<["activate", "suspend", "block", "unblock"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "activate" | "suspend" | "block" | "unblock";
    reason?: string | undefined;
}, {
    action: "activate" | "suspend" | "block" | "unblock";
    reason?: string | undefined;
}>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type TenantActionInput = z.infer<typeof tenantActionSchema>;
