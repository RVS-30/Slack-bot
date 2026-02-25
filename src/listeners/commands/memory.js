export function registerMemoryCommand(app) {
  app.command("/memory", async ({ command, ack, respond }) => {
    await ack();
    await respond("Memory bot is running.");
  });
}
