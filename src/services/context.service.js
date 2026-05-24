import pool from "../config/database.js";

// Registry — each command declares what context types it cares about.
// To add a new command: add one entry here. Nothing else changes.
export const CONTEXT_REGISTRY = {
  ask:       ["ask", "summarize", "search"],
  summarize: ["ask", "summarize"],
  search:    ["ask", "search"],
  decisions: [], // raw DB fetch — no generative context needed
};

const SESSION_WINDOW_HOURS = 2;
const SESSION_MAX_ENTRIES = 3;

// Fetch recent relevant interactions for a user in a channel
export async function getContextForCommand(workspaceId, userId, channelId, commandType) {
  const relevantTypes = CONTEXT_REGISTRY[commandType];

  // Command not in registry or explicitly wants no context
  if (!relevantTypes || relevantTypes.length === 0) return [];

  const windowStart = new Date(Date.now() - SESSION_WINDOW_HOURS * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `SELECT command_type, input, output, metadata, created_at
     FROM interaction_log
     WHERE workspace_id = $1
       AND user_id = $2
       AND channel_id = $3
       AND command_type = ANY($4::text[])
       AND created_at >= $5
     ORDER BY created_at DESC
     LIMIT $6`,
    [workspaceId, userId, channelId, relevantTypes, windowStart, SESSION_MAX_ENTRIES]
  );

  // Return chronological order — oldest first, so prompt reads naturally
  return rows.reverse();
}

// Format context rows into a prompt-injectable string
export function formatContextForPrompt(contextRows) {
  if (contextRows.length === 0) return null;

  const lines = contextRows.map((r) => {
    const ts = new Date(r.created_at).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const label = r.command_type.toUpperCase();
    const input = r.input ? ` | "${r.input}"` : "";
    return `[${ts}] /${label}${input}\n${r.output}`;
  });

  return lines.join("\n\n---\n\n");
}

// Log any command interaction — replaces insertMemoryQuery
export async function logInteraction(workspaceId, userId, channelId, commandType, input, output, metadata = {}) {
  await pool.query(
    `INSERT INTO interaction_log
      (workspace_id, user_id, channel_id, command_type, input, output, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [workspaceId, userId, channelId, commandType, input ?? null, output, JSON.stringify(metadata)]
  );
}