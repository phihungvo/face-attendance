import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { authenticateToken } from "./auth.js";
import { config } from "./config.js";

export type SocketGateway = {
  io: Server;
  pub: Redis;
  sub: Redis;
};

export async function createSocketGateway(server: http.Server): Promise<SocketGateway> {
  const io = new Server(server, {
    path: "/ws",
    cors: { origin: config.corsOrigin === "*" ? true : config.corsOrigin, credentials: true }
  });

  const pub = new Redis(config.redisUrl);
  const sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub));

  io.use(async (socket, next) => {
    try {
      const token = String((socket.handshake.query as any)?.token ?? "");
      if (!token) return next(new Error("Missing token"));
      const u = await authenticateToken(token);
      (socket as any).userId = u.userId;
      (socket as any).companyId = u.companyId;
      (socket as any).role = u.role;
      (socket as any).departmentId = u.departmentId;
      (socket as any).departmentCode = u.departmentCode;
      return next();
    } catch (e: any) {
      return next(new Error(e?.message || "Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as number;
    const companyId = (socket as any).companyId as number | null;
    const role = (socket as any).role as string;
    const departmentId = (socket as any).departmentId as number | null;
    const departmentCode = (socket as any).departmentCode as string | null;

    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);
    if (companyId != null) socket.join(`company:${companyId}`);
    if (departmentId != null) socket.join(`department:${departmentId}`);
    if (departmentCode) socket.join(`department:${departmentCode}`);
  });

  return { io, pub, sub };
}

