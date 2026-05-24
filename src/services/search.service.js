import { GoogleGenAI } from "@google/genai";
import { config } from "../config/environment.js";
import { searchHybrid } from "../repositories/message.repository.js";
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
    return "Your search could not be processed. Try rephrasing it.";
  return "Something went wrong with the search. Please try again.";
}

function formatResultsForSlack(rows) {
  return rows.map((r) => {
    const ts = new Date(r.last_message_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const similarity = Math.round(r.similarity * 100);
    return {
      content: r.content,
      channel_id: r.channel_id,
      thread_ts: r.thread_ts,
      message_count: r.message_count,
      last_message_at: ts,
      similarity,
    };
  });
}

export async function searchMemory(workspaceId, userId, channelId, query) {
  console.log(
    `${CYAN}🔎 Search query — workspace: ${workspaceId} | user: ${userId}${RESET}`,
  );
  console.log(`${CYAN}   Q: "${query}"${RESET}`);

  // Fetch session context
  const contextRows = await getContextForCommand(workspaceId, userId, channelId, "search");
  const priorContext = formatContextForPrompt(contextRows);
  if (priorContext) {
    console.log(`${CYAN}   ↳ Prior context entries: ${contextRows.length}${RESET}`);
  }

  let queryVector;

  try {
    const embeddingResult = await genAI.models.embedContent({
      model: "gemini-embedding-001",
      contents: query,
      config: { outputDimensionality: 768 },
    });
    queryVector = embeddingResult.embeddings[0].values;
  } catch (err) {
    console.error("❌ Embedding error:", err);
    throw new Error(classifyError(err));
  }

  const results = await searchHybrid(workspaceId, queryVector, query, 5);
  console.log(`${YELLOW}   ↳ Results found: ${results.length}${RESET}`);

  if (results.length === 0) {
    const fallback = "No matching threads found for your search.";
    logInteraction(workspaceId, userId, channelId, "search", query, fallback, { resultCount: 0 });
    return { results: [], formatted: [] };
  }

  const formatted = formatResultsForSlack(results);

  console.log(`${GREEN}   ↳ Search complete (${formatted.length} results)${RESET}`);

  // Non-blocking log — store top result contents as output for future context
  const outputSummary = formatted
    .map((r, i) => `[Result ${i + 1}] ${r.content.slice(0, 200)}`)
    .join("\n\n");

  logInteraction(workspaceId, userId, channelId, "search", query, outputSummary, { resultCount: formatted.length });

  return { results: formatted, priorContext };
}