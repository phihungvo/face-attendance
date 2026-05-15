import dotenv from "dotenv";
dotenv.config();

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8010),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  jwtSecret: must("JWT_SECRET"),
  redisUrl: must("REDIS_URL"),
  redisChannel: process.env.NOTIF_REDIS_CHANNEL || "notif.events",
  databaseUrl: must("DATABASE_URL")
};

