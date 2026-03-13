import { classifyMessage } from "../services/awareness.service.js";
import pool from "../config/database.js";

export async function runAwarenessWorker() {
    try {

        const { rows: messages } = await pool.query(`
            SELECT id, text
            FROM messages
            WHERE processed = false
            ORDER BY created_at
            LIMIT 20
            FOR UPDATE SKIP LOCKED
        `);

        if (!messages?.length) return;

        for (const msg of messages) {

            const awareness = await classifyMessage(msg.text);

            console.log(`🧠 Processing message: ${msg.id}`);

            await pool.query(
                `
                UPDATE messages
                SET
                    message_type = $1,
                    importance_score = $2,
                    entities = $3,
                    topic_tags = $4,
                    processed = true
                WHERE id = $5
                `,
                [
                    awareness.message_type,
                    awareness.importance_score,
                    awareness.entities,
                    awareness.topic_tags,
                    msg.id
                ]
            );

            console.log("🧠 Processed message:", msg.id);
        }

    } catch (err) {
        console.error("Awareness worker failed:", err);
    }
}