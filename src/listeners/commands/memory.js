import { answerFromMemory } from "../../services/rag.service.js";
import { getDecisions } from "../../repositories/message.repository.js";
import { summarizeChannel } from "../../services/summary.service.js";

export function registerMemoryCommand(app) {
  app.command("/memory", async ({ command, ack, respond }) => {
    await ack();

    const [subcommand, ...rest] = command.text.trim().split(" ");
    const query = rest.join(" ");

    if (subcommand === "ask") {
      if (!query) {
        await respond("Usage: `/memory ask <your question>`");
        return;
      }

      await respond({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Searching workspace memory...*` },
          },
        ],
      });

      try {
        const answer = await answerFromMemory(
          command.team_id,
          command.user_id,
          command.channel_id,
          query,
        );
        await respond({
          replace_original: true,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*${query}*` },
            },
            { type: "divider" },
            {
              type: "section",
              text: { type: "mrkdwn", text: answer },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `MemGo · <@${command.user_id}> · <!date^${Math.floor(Date.now() / 1000)}^{time}|now>`,
                },
              ],
            },
          ],
        });
      } catch (err) {
        console.error("❌ /memory ask error:", err);
        await respond({
          replace_original: true,
          text: err.message,
        });
      }
      return;
    }

    if (subcommand === "decisions") {
      await respond({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Fetching workspace decisions...*` },
          },
        ],
      });

      try {
        const decisions = await getDecisions(command.team_id, 10);

        if (decisions.length === 0) {
          await respond({
            replace_original: true,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `No decisions recorded yet. Decisions are automatically detected from your conversations.`,
                },
              },
            ],
          });
          return;
        }

        const decisionBlocks = decisions.flatMap((d) => {
          const name = d.display_name || d.user_id;
          const ts = d.slack_timestamp
            ? new Date(parseFloat(d.slack_timestamp) * 1000).toLocaleString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                },
              )
            : "";
          const tags = d.topic_tags?.length ? d.topic_tags.join(", ") : null;

          return [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${d.text}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `${name} · ${ts}${tags ? ` · ${tags}` : ""}`,
                },
              ],
            },
            { type: "divider" },
          ];
        });

        await respond({
          replace_original: true,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "Workspace Decisions" },
            },
            ...decisionBlocks,
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `MemGo · ${decisions.length} decision(s) found`,
                },
              ],
            },
          ],
        });
      } catch (err) {
        console.error("❌ /memory decisions error:", err);
        await respond({
          replace_original: true,
          text: err.message,
        });
      }
      return;
    }

    if (subcommand === "summarize") {
      await respond({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Summarizing workspace memory...*` },
          },
        ],
      });

      try {
        const summary = await summarizeChannel(
          command.team_id,
          command.channel_id,
        );

        await respond({
          replace_original: true,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Channel Summary (last 7 days)*` },
            },
            { type: "divider" },
            {
              type: "section",
              text: { type: "mrkdwn", text: summary },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `MemGo · <@${command.user_id}> · <!date^${Math.floor(Date.now() / 1000)}^{time}|now>`,
                },
              ],
            },
          ],
        });
      } catch (err) {
        console.error("❌ /memory summarize error:", err);
        await respond({
          replace_original: true,
          text: err.message,
        });
      }
    }

    if (subcommand === "help") {
      await respond(
        "Available commands: `ask`, `summarize`, `search`, `save`, `decisions`",
      );
      return;
    }

    await respond(
      "Available commands: `ask`, `summarize`, `search`, `save`, `decisions`",
    );
  });
}
