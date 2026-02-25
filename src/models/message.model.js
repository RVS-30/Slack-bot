export function createMessageEntity(event, body) {
  return {
    workspace_id: body.team_id,
    channel_id: event.channel,
    user_id: event.user,

    thread_ts: event.thread_ts || event.ts,
    text: event.text || null,

    slack_timestamp: event.ts,
    channel_type: event.channel_type || null,

    raw_payload: body,

    created_at: new Date(),
  };
}