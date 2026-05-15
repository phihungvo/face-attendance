import { z } from "zod";

export const NotificationEventSchema = z.object({
  type: z.string().min(1),
  companyId: z.number().int().nullable().optional(),
  employeeId: z.number().int().optional(),
  userId: z.number().int().optional(),
  departmentId: z.number().int().nullable().optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  data: z.any().optional(),
  ts: z.string().optional()
});
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

export type NotificationTarget =
  | { kind: "user"; userId: number }
  | { kind: "role"; roleKey: "admin" | "manager" | "employee" }
  | { kind: "company"; companyId: number }
  | { kind: "department"; departmentId: number };

