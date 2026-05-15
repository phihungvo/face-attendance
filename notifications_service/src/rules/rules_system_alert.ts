import type { NotificationEvent, NotificationTarget } from "../types.js";
import type { NotificationRule, RuleContext } from "./NotificationRule.js";

export class SystemAlertRule implements NotificationRule {
  supports(eventType: string): boolean {
    return eventType === "SYSTEM_ALERT";
  }

  async route(event: NotificationEvent, _ctx: RuleContext): Promise<NotificationTarget[]> {
    return [{ kind: "role", roleKey: "admin" }];
  }

  async normalize(event: NotificationEvent, _ctx: RuleContext) {
    return {
      type: "SYSTEM_ALERT",
      severity: (event.severity ?? "CRITICAL") as any,
      title: event.title ?? "System alert",
      body: event.body ?? null,
      companyId: event.companyId ?? null,
      departmentId: event.departmentId ?? null,
      data: event.data ?? { ts: event.ts ?? null }
    };
  }
}
