import http from "http";
import { createApi } from "./api.js";
import { createSocketGateway } from "./socketGateway.js";
import { startRedisConsumer } from "./redisConsumer.js";
import { prisma } from "./prisma.js";
import { config } from "./config.js";

async function main() {
  const app = createApi();
  const server = http.createServer(app);
  const gw = await createSocketGateway(server);
  await startRedisConsumer(gw);

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`notifications_service listening on :${config.port}`);
  });
}

main()
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    // Keep process alive; prisma disconnect handled on exit.
  });

