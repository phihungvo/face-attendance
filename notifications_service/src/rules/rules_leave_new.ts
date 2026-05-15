import type { NotificationEvent, NotificationTarget } from "../types.js";
import type { NotificationRule, RuleContext } from "./NotificationRule.js";

export class LeaveNewRule implements NotificationRule {
  supports(eventType: string): boolean {
    return eventType === "LEAVE_NEW";
  }

  async route(event: NotificationEvent, ctx: RuleContext): Promise<NotificationTarget[]> {
    const employeeId = event.employeeId ?? event.userId;
    const departmentId = event.departmentId ?? (employeeId ? (await ctx.resolveEmployee(employeeId))?.departmentId : null);
    if (!departmentId) return [];
    const managers = await ctx.resolveManagersInDepartment(departmentId);
    return managers.map((userId) => ({ kind: "user", userId }));
  }

  async normalize(event: NotificationEvent, ctx: RuleContext) {
    const employeeId = event.employeeId ?? event.userId;
    const employee = employeeId ? await ctx.resolveEmployee(employeeId) : null;
    return {
      type: "LEAVE_NEW",
      severity: "INFO" as const,
      title: event.title ?? "Có đơn nghỉ mới",
      body: event.body ?? null,
      companyId: (event.companyId ?? employee?.companyId ?? null) as number | null,
      departmentId: (event.departmentId ?? employee?.departmentId ?? null) as number | null,
      data: event.data ?? { employeeId, leaveId: (event as any).leaveId ?? null, ts: event.ts ?? null }
    };
  }
}
