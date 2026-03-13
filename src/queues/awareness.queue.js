import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config/environment.js";

const connection = new IORedis(config.redisUrl);

connection.on("connect", () => {
  console.log("🔗 Redis connected for awareness queue");
});

connection.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

export const awarenessQueue = new Queue("awareness", {
  connection,
});

console.log("📬 Awareness queue initialized");