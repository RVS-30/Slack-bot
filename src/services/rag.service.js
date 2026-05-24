import { GoogleGenAI } from "@google/genai";
import { config } from "../config/environment.js";
import { searchThreads } from "../repositories/message.repository.js";
import {
  getContextForCommand,
  formatContextForPrompt,
  logInteraction,
} from "./context.service.js";

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
    return "Your question could not be processed. Try rephrasing it.";
  return "Something went wrong on our end. Please try again.";
}

export async function answerFromMemory(
  workspaceId,
  userId,
  channelId,
  question,
) {
  console.log(
    `${CYAN}🔍 Memory query — workspace: ${workspaceId} | user: ${userId}${RESET}`,
  );
  console.log(`${CYAN}   Q: "${question}"${RESET}`);

  // Fetch session context
  const contextRows = await getContextForCommand(workspaceId, userId, channelId, "ask");
  const priorContext = formatContextForPrompt(contextRows);
  if (priorContext) {
    console.log(`${CYAN}   ↳ Prior context entries: ${contextRows.length}${RESET}`);
  }

  let questionVector;

  try {
    const embeddingResult = await genAI.models.embedContent({
      model: "gemini-embedding-001",
      contents: question,
      config: { outputDimensionality: 768 },
    });
    questionVector = embeddingResult.embeddings[0].values;
  } catch (err) {
    console.error("❌ Embedding error:", err);
    throw new Error(classifyError(err));
  }

  const threads = await searchThreads(workspaceId, questionVector, 5);
  console.log(`${YELLOW}   ↳ Threads retrieved: ${threads.length}${RESET}`);

  if (threads.length === 0) {
    const fallback =
      "No relevant memory found yet. Send some messages in Slack, wait a few minutes, and try again.";
    logInteraction(workspaceId, userId, channelId, "ask", question, fallback, { threadsUsed: 0 });
    return fallback;
  }

  const context = threads
    .map((t, i) => `[Thread ${i + 1}]\n${t.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are a workspace memory assistant for a Slack workspace.
Today is ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
${priorContext ? `
The user has recently interacted with MemGo in this channel. Use this as conversational context to resolve references and avoid asking for information already established:

--- Prior Session Context ---
${priorContext}
--- End Prior Context ---
` : ""}
Answer the question using ONLY the workspace memory context below. If the answer is not in the context, say so clearly.
Be concise and direct.

Guidelines:
- Where relevant, mention who said something by name.
- Where relevant, mention when something was discussed if the timing adds useful context.
- Do not force attribution or timestamps where they don't add value.
- Every piece of context has a timestamp. Use it. Reason about when something was said relative to today.
- Time-bound statements must be reframed relative to today. Do not quote "I'll do it today" if it was said 3 days ago — interpret it against the actual date it was written.
- Do not present past commitments as current facts without qualification.
- If the user's question references something from the prior session context above, use it to resolve the reference — do not ask for clarification if the answer is already there.

Workspace Memory Context:
${context}

Question: ${question}`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const answer = result.text;

    console.log(
      `${GREEN}   ↳ Answer generated (${answer.length} chars)${RESET}`,
    );

    // Non-blocking log
    logInteraction(workspaceId, userId, channelId, "ask", question, answer, { threadsUsed: threads.length });

    return answer;
  } catch (err) {
    console.error("❌ Generation error:", err);
    throw new Error(classifyError(err));
  }
}