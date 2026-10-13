import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAssistantResponse, validateChatRequest } from "./assistant.mjs";

test("chat validation bounds messages and rejects unsupported roles", () => {
  assert.throws(() => validateChatRequest({ messages: [] }), { code: "INVALID_MESSAGES" });
  assert.throws(
    () => validateChatRequest({ messages: [{ role: "system", text: "no" }] }),
    { code: "INVALID_MESSAGE" },
  );
  assert.equal(
    validateChatRequest({ messages: [{ role: "user", text: "help" }] }).messages.length,
    1,
  );
});

test("Gemini proxy uses server key and extracts generated text", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-test-model";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  });

  let requestUrl = "";
  let requestOptions;
  const result = await generateAssistantResponse(
    { messages: [{ role: "user", text: "Summarize this workspace." }], context: "1 brand" },
    async (url, options) => {
      requestUrl = String(url);
      requestOptions = options;
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "One registered brand." }] } }] }),
        { status: 200 },
      );
    },
  );
  assert.match(requestUrl, /models\/gemini-test-model:generateContent$/);
  assert.equal(requestOptions.headers["x-goog-api-key"], "test-gemini-key");
  assert.equal(result.answer, "One registered brand.");
});

test("Gemini rate-limit errors are safe and do not retry", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  await assert.rejects(
    generateAssistantResponse(
      { messages: [{ role: "user", text: "hello" }] },
      async () => new Response("private upstream details", { status: 429 }),
    ),
    (error) => error.code === "ASSISTANT_RATE_LIMITED" && !error.message.includes("private"),
  );
});
