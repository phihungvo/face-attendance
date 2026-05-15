import type { NotificationEvent, NotificationTarget } from "../types.js";

export type RuleContext = {
  resolveManagersInDepartment(departmentId: number): Promise<number[]>;
  resolveManagersInCompany(companyId: number): Promise<number[]>;
  resolveEmployee(userId: number): Promise<{ companyId: number | null; departmentId: number | null } | null>;
};

export interface NotificationRule {
  supports(eventType: string): boolean;
  route(event: NotificationEvent, ctx: RuleContext): Promise<NotificationTarget[]>;
  normalize(event: NotificationEvent, ctx: RuleContext): Promise<{
    type: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    body: string | null;
    companyId: number | null;
    departmentId: number | null;
    data: any;
  }>;
}

