import {
  handleIncomingMessage,
  handleMessageEdit,
  handleMessageDelete
} from "../../services/message.service.js";

export function registerMessage(app) {
  app.event("message", async ({ event, body }) => {
    try {
      // Prevent bot loops
      if (event.bot_id) return;

      // 🧠 Lifecycle routing
      if (event.subtype === "message_changed") {
        return await handleMessageEdit(event, body);
      }

      if (event.subtype === "message_deleted") {
        return await handleMessageDelete(event, body);
      }

      if (event.subtype) return;

      // 🆕 Only real messages reach here
      return await handleIncomingMessage(event, body);

    } catch (error) {
      console.error("❌ Message processing failed:", error);
    }
  });
}