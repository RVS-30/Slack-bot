import pkg from "@slack/bolt";
const { App } = pkg;
import { config } from "./config/environment.js";
import { loggerMiddleware } from "./middleware/logger.middleware.js";
import { registerListeners } from "./listeners/index.js";

const app = new App({
  token: config.slackBotToken,
  signingSecret: config.slackSigningSecret,
});

app.use(loggerMiddleware);

registerListeners(app);

export { app, config };
