import { z } from 'zod';
export declare const userRoleSchema: z.ZodEnum<["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "AGENT", "USER"]>;
export declare const userStatusSchema: z.ZodEnum<["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED"]>;
export declare const createUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "AGENT", "USER"]>>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    role: "SUPER_ADMIN" | "TENANT_ADMIN" | "MANAGER" | "AGENT" | "USER";
    phone?: string | undefined;
}, {
    name: string;
    email: string;
    password: string;
    phone?: string | undefined;
    role?: "SUPER_ADMIN" | "TENANT_ADMIN" | "MANAGER" | "AGENT" | "USER" | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "AGENT", "USER"]>>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED"]>>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    password?: string | undefined;
    status?: "ACTIVE" | "SUSPENDED" | "INACTIVE" | "PENDING" | undefined;
    phone?: string | undefined;
    role?: "SUPER_ADMIN" | "TENANT_ADMIN" | "MANAGER" | "AGENT" | "USER" | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    password?: string | undefined;
    status?: "ACTIVE" | "SUSPENDED" | "INACTIVE" | "PENDING" | undefined;
    phone?: string | undefined;
    role?: "SUPER_ADMIN" | "TENANT_ADMIN" | "MANAGER" | "AGENT" | "USER" | undefined;
}>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
