import { GoogleGenAI } from '@google/genai';
import { config } from '../config/environment.js';
import { searchThreads } from '../repositories/message.repository.js';

const genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });

function classifyError(err) {
  const status = err?.status || err?.original?.status;
  if (status === 503) return 'Gemini is temporarily unavailable due to high demand. Please try again in a moment.';
  if (status === 429) return 'Rate limit reached. Please wait a few seconds and try again.';
  if (status === 400) return 'Your question could not be processed. Try rephrasing it.';
  return 'Something went wrong on our end. Please try again.';
}

export async function answerFromMemory(workspaceId, question) {
  let questionVector;

  try {
    const embeddingResult = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: question,
      config: { outputDimensionality: 768 },
    });
    questionVector = embeddingResult.embeddings[0].values;
  } catch (err) {
    console.error('❌ Embedding error:', err);
    throw new Error(classifyError(err));
  }

  const threads = await searchThreads(workspaceId, questionVector, 5);

  if (threads.length === 0) {
    return "No relevant memory found yet. Send some messages in Slack, wait a few minutes, and try again.";
  }

  const context = threads
    .map((t, i) => `[Thread ${i + 1}]\n${t.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are an organizational memory assistant for a Slack workspace.
Answer the question using ONLY the context below. If the answer is not in the context, say so clearly.
Be concise and direct.

Context:
${context}

Question: ${question}`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return result.text;
  } catch (err) {
    console.error('❌ Generation error:', err);
    throw new Error(classifyError(err));
  }
}