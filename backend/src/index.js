require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const createApp = require("./server");
const config = require("./config");
const prisma = require("./models/prismaClient");
const { registerSocketHandlers } = require("./socket/socketHandlers");

async function bootstrap() {
  // Verify DB connection
  await prisma.$connect();
  console.log("Database connected");

  const app = createApp();
  const server = http.createServer(app);
  const allowAllOrigins = config.clientUrls.includes("*");
  const allowedOrigins = new Set(config.clientUrls);

  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowAllOrigins || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by Socket.IO CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  registerSocketHandlers(io);

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
