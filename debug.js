// Granular debug — isolate what hangs inside app.js
console.log(">>> 1: Loading dotenv...");
await import("dotenv/config");
console.log(">>> 1: done ✅");

console.log(">>> 2: Loading @slack/bolt...");
const boltPkg = await import("@slack/bolt");
const { App } = boltPkg.default || boltPkg;
console.log(">>> 2: done ✅");

console.log(">>> 3: Loading config...");
const { config } = await import("./src/config/environment.js");
console.log(">>> 3: done ✅");

console.log(">>> 4: Creating Slack App instance...");
const app = new App({
  token: config.slackBotToken,
  signingSecret: config.slackSigningSecret,
});
console.log(">>> 4: done ✅");

console.log(">>> 5: Registering listeners...");
const { registerListeners } = await import("./src/listeners/index.js");
registerListeners(app);
console.log(">>> 5: done ✅");

console.log(">>> 6: Starting app...");
await app.start(Number(process.env.PORT) || 4390);
console.log(">>> 6: App running ✅");

process.exit(0);
