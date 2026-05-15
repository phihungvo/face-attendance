import type { NotificationEvent, NotificationTarget } from "../types.js";
import type { NotificationRule, RuleContext } from "./NotificationRule.js";

export class LeaveRejectedRule implements NotificationRule {
  supports(eventType: string): boolean {
    return eventType === "LEAVE_REJECTED";
  }

  async route(event: NotificationEvent, ctx: RuleContext): Promise<NotificationTarget[]> {
    const employeeId = event.employeeId ?? event.userId;
    if (!employeeId) return [];
    return [{ kind: "user", userId: employeeId }];
  }

  async normalize(event: NotificationEvent, ctx: RuleContext) {
    const employeeId = event.employeeId ?? event.userId;
    const employee = employeeId ? await ctx.resolveEmployee(employeeId) : null;
    return {
      type: "LEAVE_REJECTED",
      severity: "WARNING" as const,
      title: event.title ?? "Đơn nghỉ bị từ chối",
      body: event.body ?? null,
      companyId: (event.companyId ?? employee?.companyId ?? null) as number | null,
      departmentId: (event.departmentId ?? employee?.departmentId ?? null) as number | null,
      data: event.data ?? { employeeId, leaveId: (event as any).leaveId ?? null, ts: event.ts ?? null }
    };
  }
}
