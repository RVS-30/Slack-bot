export async function loggerMiddleware({ body, next }) {
  const timestamp = new Date().toISOString();
  const type = body.type || "unknown";
  const event = body.event?.type || body.command || "N/A";

  // Minimal production log
  console.log(`[${timestamp}] Slack Event → type: ${type} | event: ${event}`);

  // Useful optional quick fields
  if (body.event?.text) {
    console.log(`💬 Message: ${body.event.text.slice(0,120)}`);
  }

  if (body.event?.user) {
    console.log(`👤 User: ${body.event.user}`);
  }

  if (body.event?.channel) {
    console.log(`📢 Channel: ${body.event.channel}`);
  }

  // -------------------------------
  // FULL DEBUG LOG (ENABLE IF NEEDED)
  // -------------------------------

  // console.log(`[${timestamp}] Incoming ${type} | event: ${event}`);
  // console.log(JSON.stringify(body, null, 2));

  await next();
}