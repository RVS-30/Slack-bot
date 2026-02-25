import { handleIncomingMessage } from "../../services/message.service.js";

export function registerMessage(app) {
  app.event("message", async ({ event, body }) => {
    // Prevent bot loops
    if (event.bot_id) return;

    try {
      await handleIncomingMessage(event, body);
    } catch (error) {
      console.error("❌ Message processing failed:", error);
    }
  });
}