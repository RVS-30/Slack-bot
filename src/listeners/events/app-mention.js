export function registerAppMention(app) {
  app.event("app_mention", async ({ event, say }) => {
    await say("\u{1f44b} I'm alive!");
  });
}
