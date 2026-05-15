import type { NotificationEvent, NotificationTarget } from "./types.js";
import { NotificationEventSchema } from "./types.js";
import { rules } from "./rules/index.js";
import { prisma } from "./prisma.js";

function uniqTargets(targets: NotificationTarget[]) {
  const seen = new Set<string>();
  const out: NotificationTarget[] = [];
  for (const t of targets) {
    const k = t.kind === "user" ? `u:${t.userId}` : t.kind === "role" ? `r:${t.roleKey}` : t.kind === "company" ? `c:${t.companyId}` : `d:${t.departmentId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function roomForTarget(t: NotificationTarget) {
  if (t.kind === "user") return `user:${t.userId}`;
  if (t.kind === "role") return `role:${t.roleKey}`;
  if (t.kind === "company") return `company:${t.companyId}`;
  return `department:${t.departmentId}`;
}

export function createRuleContext() {
  return {
    async resolveManagersInDepartment(departmentId: number) {
      const users = await prisma.user.findMany({
        where: { departmentId },
        include: { userRoles: { include: { role: true } } }
      });
      return users.filter((u) => u.userRoles.some((ur) => ur.role.key === "manager")).map((u) => u.id);
    },
    async resolveManagersInCompany(companyId: number) {
      const users = await prisma.user.findMany({
        where: { companyId },
        include: { userRoles: { include: { role: true } } }
      });
      return users.filter((u) => u.userRoles.some((ur) => ur.role.key === "manager")).map((u) => u.id);
    },
    async resolveEmployee(userId: number) {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (!u) return null;
      return { companyId: u.companyId ?? null, departmentId: u.departmentId ?? null };
    }
  };
}

export async function processEvent(raw: unknown) {
  const event = NotificationEventSchema.parse(raw) as NotificationEvent;
  const rule = rules.find((r) => r.supports(event.type));
  if (!rule) return { delivered: 0 };
  const ctx = createRuleContext();
  const normalized = await rule.normalize(event, ctx);
  const targets = uniqTargets(await rule.route(event, ctx));
  if (!targets.length) return { delivered: 0 };

  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const t of targets) {
      const row = await tx.notification.create({
        data: {
          companyId: normalized.companyId,
          departmentId: normalized.departmentId,
          userId: t.kind === "user" ? t.userId : null,
          roleKey: t.kind === "role" ? t.roleKey : null,
          type: normalized.type,
          severity: normalized.severity as any,
          title: normalized.title,
          body: normalized.body,
          data: normalized.data as any,
          isRead: false
        }
      });
      out.push({ target: t, notification: row });
    }
    return out;
  });

  return { delivered: created.length, created };
}
