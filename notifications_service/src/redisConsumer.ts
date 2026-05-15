import Redis from "ioredis";
import { config } from "./config.js";
import { processEvent, roomForTarget } from "./ruleEngine.js";
import type { SocketGateway } from "./socketGateway.js";
import { prisma } from "./prisma.js";
import { NotificationEventSchema } from "./types.js";
import { serializeNotification } from "./serialize.js";

export async function startRedisConsumer(gw: SocketGateway) {
  const sub = new Redis(config.redisUrl);
  await sub.subscribe(config.redisChannel);

  sub.on("message", async (_ch, message) => {
    try {
      const parsed = JSON.parse(message);
      const event = NotificationEventSchema.parse(parsed);
      const res = await processEvent(event);
      const created = (res as any).created as Array<{ target: any; notification: any }> | undefined;
      if (!created?.length) return;

      for (const it of created) {
        const t = it.target;
        const room = roomForTarget(t);
        const userId = t.kind === "user" ? t.userId : null;
        const unread = userId ? await prisma.notification.count({ where: { userId, isRead: false } }) : null;
        gw.io.to(room).emit("notification", { notification: serializeNotification(it.notification), unread, event });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("notif consumer error", e);
    }
  });
}
