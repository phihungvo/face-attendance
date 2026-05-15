import type { NotificationEvent, NotificationTarget } from "../types.js";
import type { NotificationRule, RuleContext } from "./NotificationRule.js";

export class EmployeeCheckoutSuccessRule implements NotificationRule {
  supports(eventType: string): boolean {
    return eventType === "CHECKOUT_SUCCESS";
  }

  async route(event: NotificationEvent, ctx: RuleContext): Promise<NotificationTarget[]> {
    const employeeId = event.employeeId ?? event.userId;
    if (!employeeId) return [];
    const employee = await ctx.resolveEmployee(employeeId);
    const targets: NotificationTarget[] = [{ kind: "user", userId: employeeId }];
    if (employee?.departmentId) {
      const managers = await ctx.resolveManagersInDepartment(employee.departmentId);
      for (const mid of managers) targets.push({ kind: "user", userId: mid });
    }
    return targets;
  }

  async normalize(event: NotificationEvent, ctx: RuleContext) {
    const employeeId = event.employeeId ?? event.userId;
    const employee = employeeId ? await ctx.resolveEmployee(employeeId) : null;
    return {
      type: "CHECKOUT_SUCCESS",
      severity: "INFO" as const,
      title: event.title ?? "Checkout thành công",
      body: event.body ?? null,
      companyId: (event.companyId ?? employee?.companyId ?? null) as number | null,
      departmentId: (event.departmentId ?? employee?.departmentId ?? null) as number | null,
      data: event.data ?? { employeeId, ts: event.ts ?? null }
    };
  }
}
