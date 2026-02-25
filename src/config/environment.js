import "dotenv/config";

const required = ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  port: Number(process.env.PORT) || 4390,
};
