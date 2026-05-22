import { GoogleGenAI } from "@google/genai";
import { config } from "../config/environment.js";
import { getSummaryMessages } from "../repositories/message.repository.js";

const genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function classifyError(err) {
  const status = err?.status || err?.original?.status;
  if (status === 503)
    return "Gemini is temporarily unavailable due to high demand. Please try again in a moment.";
  if (status === 429)
    return "Rate limit reached. Please wait a few seconds and try again.";
  if (status === 400)
    return "The messages could not be summarized. Please try again.";
  return "Something went wrong generating the summary. Please try again.";
}

function formatMessagesForPrompt(rows) {
  return rows
    .map((r) => {
      const name = r.display_name || r.user_id;
      const ts = new Date(parseFloat(r.slack_timestamp) * 1000).toLocaleString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      );
      const typeTag =
        r.message_type !== "conversation" ? ` [${r.message_type}]` : "";
      return `[${ts}]${typeTag} ${name}: ${r.text}`;
    })
    .join("\n");
}

export async function summarizeChannel(workspaceId, channelId) {
  const toUnix = Date.now() / 1000;
  const fromUnix = toUnix - 7 * 24 * 60 * 60;

  console.log(
    `${CYAN}📋 Summary request — workspace: ${workspaceId} | channel: ${channelId}${RESET}`,
  );
  console.log(`${CYAN}   Range: ${fromUnix} to ${toUnix}${RESET}`);

  const messages = await getSummaryMessages(
    workspaceId,
    channelId,
    fromUnix,
    toUnix,
  );
  console.log(`${YELLOW}   ↳ Messages fetched: ${messages.length}${RESET}`);

  if (messages.length === 0) {
    return "No messages found in this channel over the last 7 days.";
  }

  const formatted = formatMessagesForPrompt(messages);

  const prompt = `You are a workspace memory assistant summarizing a Slack channel.
Today is ${new Date(toUnix * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
The messages below are from the last 7 days.

Produce a concise summary with these sections — only include a section if there is relevant content:

**Decisions Made** — List any decisions that were reached.
**Tasks & Action Items** — List any tasks assigned or work committed to, with owner if mentioned.
**Key Discussions** — Briefly describe the main topics discussed.
**Questions Raised** — List any open or unanswered questions.

Guidelines:
- Be concise. Each point should be one sentence.
- Where relevant, attribute to the person by name.
- Skip any section that has no content — do not include empty headers.
- Do not pad or add filler. If the channel was quiet, say so briefly.

Messages:
${formatted}`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const summary = result.text;
    console.log(
      `${GREEN}   ↳ Summary generated (${summary.length} chars)${RESET}`,
    );

    return summary;
  } catch (err) {
    console.error("❌ Summary generation error:", err);
    throw new Error(classifyError(err));
  }
}
