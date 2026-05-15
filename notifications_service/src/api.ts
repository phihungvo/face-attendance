import express from "express";
import helmet from "helmet";
import cors from "cors";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { config } from "./config.js";
import { serializeNotification } from "./serialize.js";

function authMiddleware(req: any, res: any, next: any) {
  try {
    const h = String(req.headers.authorization || "");
    const token = h.startsWith("Bearer ") ? h.slice("Bearer ".length) : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as any;
    const userId = Number(String(payload?.sub ?? ""));
    if (!Number.isFinite(userId) || userId <= 0) return res.status(401).json({ error: "Unauthorized" });
    req.userId = userId;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function createApi() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/notifications", authMiddleware, async (req: any, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const cursor = req.query.cursor ? BigInt(String(req.query.cursor)) : null;
    const unread = req.query.unread === "true" ? true : req.query.unread === "false" ? false : null;
    const type = req.query.type ? String(req.query.type) : null;
    const severity = req.query.severity ? String(req.query.severity) : null;
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where: any = { userId: req.userId };
    if (unread != null) where.isRead = !unread ? true : false;
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    if (cursor) where.id = { lt: cursor };

    const items = await prisma.notification.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit
    });
    const nextCursor = items.length ? String(items[items.length - 1]!.id) : null;
    res.json({ items: items.map(serializeNotification), nextCursor });
  });

  app.get("/notifications/unread", authMiddleware, async (req: any, res) => {
    const count = await prisma.notification.count({ where: { userId: req.userId, isRead: false } });
    res.json({ unread: count });
  });

  app.patch("/notifications/:id/read", authMiddleware, async (req: any, res) => {
    const id = BigInt(req.params.id);
    const item = await prisma.notification.updateMany({
      where: { id, userId: req.userId },
      data: { isRead: true, readAt: new Date() }
    });
    res.json({ updated: item.count > 0 });
  });

  app.patch("/notifications/read-all", authMiddleware, async (req: any, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true, readAt: new Date() }
    });
    res.json({ updated: result.count });
  });

  app.delete("/notifications/:id", authMiddleware, async (req: any, res) => {
    const id = BigInt(req.params.id);
    const result = await prisma.notification.deleteMany({ where: { id, userId: req.userId } });
    res.json({ deleted: result.count > 0 });
  });

  app.get("/notification/preferences", authMiddleware, async (req: any, res) => {
    const pref =
      (await prisma.notificationPreference.findUnique({ where: { userId: req.userId } })) ??
      (await prisma.notificationPreference.create({ data: { userId: req.userId, enabled: true } }));
    res.json(pref);
  });

  app.patch("/notification/preferences", authMiddleware, async (req: any, res) => {
    const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
    const muteTypes = req.body?.muteTypes ?? undefined;
    const pref =
      (await prisma.notificationPreference.findUnique({ where: { userId: req.userId } })) ??
      (await prisma.notificationPreference.create({ data: { userId: req.userId, enabled: true } }));
    const updated = await prisma.notificationPreference.update({
      where: { userId: pref.userId },
      data: {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(muteTypes !== undefined ? { muteTypes } : {})
      }
    });
    res.json(updated);
  });

  return app;
}
