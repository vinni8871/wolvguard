import { ProviderError } from "./providers.mjs";

const SYSTEM_INSTRUCTION =
  "You are the WOLVGUARD product assistant. Help users understand the workspace, provider results, and explainable risk signals. Treat scores as investigation leads, never proof of impersonation. Do not claim that an account was reported, removed, or verified unless the user performed that action in the product. Use only the supplied workspace context for user-specific facts. If data is missing, say so. Keep responses concise and practical.";

export function validateChatRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProviderError("INVALID_REQUEST", "Send a valid assistant message.", 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
    throw new ProviderError("INVALID_MESSAGES", "Send 1 to 12 recent chat messages.", 400);
  }
  const messages = body.messages.map((message) => {
    if (
      !message ||
      !["user", "model"].includes(message.role) ||
      typeof message.text !== "string" ||
      !message.text.trim() ||
      message.text.length > 1200
    ) {
      throw new ProviderError("INVALID_MESSAGE", "Each message must contain a role and up to 1,200 characters.", 400);
    }
    return {
      role: message.role,
      parts: [{ text: message.text.trim() }],
    };
  });
  const context = typeof body.context === "string" ? body.context.slice(0, 3000) : "";
  if (messages.reduce((total, message) => total + message.parts[0].text.length, 0) > 6000) {
    throw new ProviderError("CHAT_TOO_LARGE", "Shorten the conversation and try again.", 413);
  }
  return { messages, context };
}

export async function generateAssistantResponse(body, fetcher = fetch) {
  const { messages, context } = validateChatRequest(body);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("NOT_CONFIGURED", "The assistant is not configured on the server.", 503);
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
    throw new ProviderError("MODEL_CONFIG", "The assistant model configuration is invalid.", 503);
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nWorkspace context:\n${context || "No workspace context supplied."}` }],
        },
        contents: messages,
        generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ProviderError("ASSISTANT_UNREACHABLE", "The assistant could not be reached. Try again later.", 503);
  }
  if (response.status === 429) {
    throw new ProviderError("ASSISTANT_RATE_LIMITED", "The assistant is busy. Wait a moment and retry.", 429);
  }
  if (!response.ok) {
    throw new ProviderError("ASSISTANT_ERROR", "The assistant could not answer right now.", 503);
  }
  const data = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part) => typeof part === "string")
    .join("\n")
    .trim();
  if (!text) {
    throw new ProviderError("ASSISTANT_EMPTY", "The assistant did not return an answer. Rephrase and try again.", 502);
  }
  return { answer: text, model };
}
