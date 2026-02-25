import pool from "../config/database.js";

export async function insertMessage(message) {
  const query = `
    INSERT INTO messages (
      workspace_id,
      channel_id,
      user_id,
      thread_ts,
      text,
      slack_timestamp,
      channel_type,
      raw_payload,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id;
  `;

  const values = [
    message.workspace_id,
    message.channel_id,
    message.user_id,
    message.thread_ts,
    message.text,
    message.slack_timestamp,
    message.channel_type,
    message.raw_payload,
    message.created_at,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}