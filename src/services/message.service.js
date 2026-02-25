import { createMessageEntity } from "../models/message.model.js";
import { insertMessage } from "../repositories/message.repository.js";

export async function handleIncomingMessage(event, body) {
  try {
    // 1️⃣ Normalize external Slack event → internal entity
    const messageEntity = createMessageEntity(event, body);

    // 2️⃣ Persist into database
    const savedMessage = await insertMessage(messageEntity);

    console.log("💾 Message saved with ID:", savedMessage.id);

    return savedMessage;
  } catch (error) {
    console.error("❌ Failed to handle incoming message:", error);
    throw error;
  }
}