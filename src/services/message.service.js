import { createMessageEntity } from "../models/message.model.js";
import {
  updateMessageText,
  markMessageDeleted,
  insertMessage
} from "../repositories/message.repository.js";

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

export async function handleMessageEdit(event, body) {
  try {
    const edited = event.message;

    if (!edited?.ts) return;

    const updatedMessage = await updateMessageText({
      workspace_id: body.team_id,
      channel_id: event.channel,
      slack_timestamp: edited.ts,
      text: edited.text,
      raw_payload: body
    });

    console.log("✏️ Message edited:", edited.ts);

    return updatedMessage;

  } catch (error) {
    console.error("❌ Failed to process message edit:", error);
    throw error;
  }
}

export async function handleMessageDelete(event, body) {
  try {

    const deletedMessage = await markMessageDeleted({
      workspace_id: body.team_id,
      channel_id: event.channel,
      slack_timestamp: event.previous_message?.ts
    });

    console.log("🗑️ Message deleted:", event.previous_message?.ts);

    return deletedMessage;

  } catch (error) {
    console.error("❌ Failed to process message delete:", error);
    throw error;
  }
}