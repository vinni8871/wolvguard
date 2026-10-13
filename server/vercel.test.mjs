import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import providersHandler from "../api/providers.mjs";
import chatHandler from "../api/chat.mjs";
import youtubeSearchHandler from "../api/youtube/search.mjs";
import indexHandler from "../api/index.mjs";
import catchAllHandler from "../api/[...path].mjs";

function createMockReqRes({ method = "GET", url = "/api/providers", headers = {}, body = null } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };
  req.body = body;
  req.socket = { remoteAddress: "127.0.0.1" };

  const res = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: "",
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
      this.headersSent = true;
      return this;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.headersSent = true;
      return this;
    },
    json() {
      return JSON.parse(this.body);
    },
  };

  return { req, res };
}

test("Vercel api/providers handler returns 200 and provider status", async () => {
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/providers" });
  await providersHandler(req, res);
  assert.equal(res.statusCode, 200);
  const json = res.json();
  assert.ok("youtube" in json);
  assert.ok("assistant" in json);
});

test("Vercel api/chat handler works with pre-parsed req.body", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-key-for-test";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });

  const { req, res } = createMockReqRes({
    method: "POST",
    url: "/api/chat",
    headers: { "content-type": "application/json" },
    body: {
      messages: [{ role: "user", text: "Hello from Vercel test" }],
    },
  });

  // Mock global fetch for this test
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Mocked Gemini response" }] } }],
      }),
      { status: 200 },
    );

  try {
    await chatHandler(req, res);
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.answer, "Mocked Gemini response");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Vercel api/youtube/search handler works with pre-parsed req.body", async (t) => {
  const previousKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "dummy-yt-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previousKey;
  });

  const { req, res } = createMockReqRes({
    method: "POST",
    url: "/api/youtube/search",
    headers: { "content-type": "application/json" },
    body: {
      term: "test-brand",
      country: "us",
      limit: 5,
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        items: [
          {
            id: { kind: "youtube#channel", channelId: "UCtest123" },
            snippet: {
              title: "Test Brand Channel",
              description: "Official channel",
              publishedAt: "2023-01-01T00:00:00Z",
              thumbnails: { default: { url: "https://yt3.ggpht.com/avatar.jpg" } },
            },
          },
        ],
      }),
      { status: 200 },
    );

  try {
    await youtubeSearchHandler(req, res);
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.candidates.length, 1);
    assert.equal(json.candidates[0].sourceId, "UCtest123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Vercel api/index.mjs routes fallback correctly", async () => {
  const { req, res } = createMockReqRes({ method: "GET", url: "/api" });
  await indexHandler(req, res);
  assert.equal(res.statusCode, 200);
  const json = res.json();
  assert.ok("youtube" in json);
});

test("Vercel api/[...path].mjs routes dynamic paths correctly", async () => {
  const { req, res } = createMockReqRes({ method: "GET", url: "/api/providers" });
  await catchAllHandler(req, res);
  assert.equal(res.statusCode, 200);
  const json = res.json();
  assert.ok("youtube" in json);
});
