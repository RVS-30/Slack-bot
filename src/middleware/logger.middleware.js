export async function loggerMiddleware({ body, next }) {
  const timestamp = new Date().toISOString();
  const type = body.type || "unknown";
  const event = body.event?.type || body.command || "N/A";

  console.log(`[${timestamp}] Incoming ${type} | event: ${event}`);
  console.log(JSON.stringify(body, null, 2));

  await next();
}
