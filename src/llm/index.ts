import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

export type LLMClient = GoogleGenerativeAI;

const genAI = new GoogleGenerativeAI(config.googleAiApiKey);

/** The top-level client — injected into AgentContext so agents can be tested with a mock. */
export const llm: LLMClient = genAI;

/**
 * Ask Gemini for a JSON-structured response.
 * @param systemPrompt  Task-specific system prompt
 * @param userMessage   The user / task content
 * @param schema        A description of the expected JSON shape (for the prompt)
 */
export async function askForJson<T>(
  systemPrompt: string,
  userMessage: string,
  schema: string,
): Promise<T> {
  // A new model instance per call so the system instruction can vary.
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: `${systemPrompt}\n\nYou MUST respond with valid JSON only — no markdown, no explanation. Schema:\n${schema}`,
  });

  const result = await model.generateContent(userMessage);
  const raw = result.response.text().trim();

  // Strip markdown code fences if Gemini wraps the output
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}
