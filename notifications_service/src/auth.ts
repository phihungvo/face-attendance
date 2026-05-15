import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { config } from "./config.js";

export type SocketAuthUser = {
  userId: number;
  companyId: number | null;
  role: "admin" | "manager" | "employee";
  departmentId: number | null;
  departmentCode: string | null;
};

function roleFromKeys(keys: string[]): SocketAuthUser["role"] {
  if (keys.includes("admin")) return "admin";
  if (keys.includes("manager")) return "manager";
  return "employee";
}

export async function authenticateToken(token: string): Promise<SocketAuthUser> {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as any;
  const sub = String(payload?.sub ?? "");
  const userId = Number(sub);
  if (!Number.isFinite(userId) || userId <= 0) throw new Error("Invalid token subject");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: true, userRoles: { include: { role: true } } }
  });
  if (!user) throw new Error("User not found");
  if (user.authStatus !== "active") throw new Error("User inactive");

  const roleKeys = user.userRoles.map((ur) => ur.role.key);
  const role = roleFromKeys(roleKeys);
  return {
    userId,
    companyId: user.companyId ?? null,
    role,
    departmentId: user.departmentId ?? null,
    departmentCode: user.department?.code ?? null
  };
}

