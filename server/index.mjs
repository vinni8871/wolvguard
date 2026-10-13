import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProviderError,
  providerRegistry,
  resolveBluesky,
  validateSearch,
} from "./providers.mjs";
import { generateAssistantResponse } from "./assistant.mjs";
import { imageFingerprint } from "./images.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const cache = new Map();
const peerRequests = new Map();
const providerWindows = { apple: [], youtube: [], bluesky: [] };
const youtubeDay = [];
let inFlight = 0;
const providerStatus = {
  apple: { status: "Not Configured", lastSuccess: null, lastError: null },
  youtube: { status: "Not Configured", lastSuccess: null, lastError: null },
  bluesky: { status: "Available", lastSuccess: null, lastError: null },
};

const hasAppleAdsConfig = () => Boolean(
  process.env.APPLE_ADS_CLIENT_ID &&
    process.env.APPLE_ADS_TEAM_ID &&
    process.env.APPLE_ADS_KEY_ID &&
    process.env.APPLE_ADS_AD_ACCOUNT_ID &&
    process.env.APPLE_ADS_PRIVATE_KEY,
);

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function parseJson(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new ProviderError("REQUEST_TOO_LARGE", "Request is too large.", 413);
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProviderError("INVALID_JSON", "Provide a valid JSON request.", 400);
  }
}

function allowPeerRequest(peer, bucket, maximum) {
  const now = Date.now();
  const key = `${peer}:${bucket}`;
  const recent = (peerRequests.get(key) ?? []).filter((timestamp) => now - timestamp < 60000);
  if (recent.length >= maximum) return false;
  recent.push(now);
  peerRequests.set(key, recent);
  return true;
}

function apiError(error) {
  if (error instanceof ProviderError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
      headers: error.status === 429 ? { "Retry-After": "60" } : {},
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } },
    headers: {},
  };
}

async function handleApi(request, response, pathname) {
  if (request.headers["sec-fetch-site"] === "cross-site") {
    return sendJson(response, 403, { error: { code: "CROSS_ORIGIN", message: "Use the same-origin application." } });
  }
  if (pathname === "/api/providers" && request.method === "GET") {
    providerStatus.apple.status = hasAppleAdsConfig() ? "Available" : "Not Configured";
    providerStatus.youtube.status = process.env.YOUTUBE_API_KEY ? "Available" : "Not Configured";
    return sendJson(response, 200, {
      ...providerStatus,
      assistant: { status: process.env.GEMINI_API_KEY ? "Available" : "Not Configured" },
      auth: { status: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "Available" : "Not Configured" },
      email: { status: "Not Configured" },
      storage: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "Supabase account" : "browser-local",
      imageComparison: { status: "Available", method: "dhash64-rgb-v1" },
    });
  }

  const provider = {
    "/api/apple/search": "apple",
    "/api/youtube/search": "youtube",
    "/api/bluesky/search": "bluesky",
  }[pathname];
  const isImage = pathname === "/api/image-fingerprint";
  const isResolve = pathname === "/api/bluesky/resolve";
  const isChat = pathname === "/api/chat";
  if (!provider && !isImage && !isResolve && !isChat) {
    return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Endpoint not supported." } });
  }
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, { Allow: "POST" });
  }
  if (!(request.headers["content-type"] ?? "").startsWith("application/json")) {
    return sendJson(response, 415, { error: { code: "CONTENT_TYPE", message: "Use application/json." } });
  }

  const peer = request.socket.remoteAddress ?? "shared";
  const bucket = isImage ? "images" : isChat ? "assistant" : isResolve ? "resolve" : provider;
  const peerLimit = isImage ? 100 : isChat ? 10 : isResolve ? 20 : 12;
  if (!allowPeerRequest(peer, bucket, peerLimit)) {
    return sendJson(response, 429, { error: { code: "RATE_LIMITED", message: "Too many requests. Wait a minute and try again." } }, { "Retry-After": "60" });
  }

  try {
    const input = await parseJson(request, isChat ? 16384 : 4096);
    if (isImage) return sendJson(response, 200, await imageFingerprint(input?.url));
    if (isResolve) return sendJson(response, 200, await resolveBluesky(input?.actor));
    if (isChat) return sendJson(response, 200, await generateAssistantResponse(input));

    const params = validateSearch(input);
    if (provider === "apple" && params.term.length < 3) {
      throw new ProviderError("INVALID_TERM", "Apple app search requires at least 3 characters.", 400);
    }
    const cacheKey = `${provider}:${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.at < 300000) {
      return sendJson(response, 200, { ...cached.data, cacheHit: true, requestAt: new Date().toISOString() });
    }

    providerWindows[provider] = providerWindows[provider].filter((timestamp) => now - timestamp < 60000);
    const providerPerMinute = provider === "youtube" ? 3 : 8;
    if (providerWindows[provider].length >= providerPerMinute || inFlight >= 2) {
      throw new ProviderError("RATE_LIMITED", "Provider request budget is busy. Wait before retrying.", 429);
    }
    if (provider === "youtube") {
      while (youtubeDay.length && now - youtubeDay[0] >= 86400000) youtubeDay.shift();
      if (youtubeDay.length >= 70) {
        throw new ProviderError("DAILY_QUOTA_GUARD", "The daily YouTube request safety budget is used. Try again tomorrow.", 429);
      }
      youtubeDay.push(now);
    }
    providerWindows[provider].push(now);
    inFlight += 1;
    let data;
    try {
      data = await providerRegistry[provider].search(params);
    } finally {
      inFlight -= 1;
    }
    providerStatus[provider] = { status: "Connected", lastSuccess: data.fetchedAt, lastError: null };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { data, at: Date.now() });
    return sendJson(response, 200, { ...data, cacheHit: false, requestAt: new Date().toISOString() });
  } catch (error) {
    const result = apiError(error);
    if (provider && result.status >= 500) {
      providerStatus[provider] = { ...providerStatus[provider], status: "Error", lastError: result.body.error.message };
    }
    return sendJson(response, result.status, result.body, result.headers);
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname.startsWith("/api/")) return handleApi(request, response, pathname);
  if (!["GET", "HEAD"].includes(request.method)) {
    return sendJson(response, 405, { error: { message: "Method not allowed." } });
  }
  try {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return sendJson(response, 400, { error: { message: "Invalid path." } });
    }
    let file = path.resolve(root, `.${decoded}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) {
      return sendJson(response, 403, { error: { message: "Access denied." } });
    }
    try {
      if (!(await stat(file)).isFile()) file = path.join(root, "index.html");
    } catch {
      if (path.extname(file) && path.extname(file) !== ".html") {
        return sendJson(response, 404, { error: { message: "File not found." } });
      }
      file = path.join(root, "index.html");
    }
    const data = await readFile(file);
    const extension = path.extname(file);
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".woff2": "font/woff2",
      ".pdf": "application/pdf",
    }[extension] ?? "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": mime,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    sendJson(response, 503, { error: { message: "Frontend not built. Run npm run build." } });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) if (now - entry.at > 300000) cache.delete(key);
  for (const [key, timestamps] of peerRequests) {
    const fresh = timestamps.filter((timestamp) => now - timestamp < 86400000);
    if (fresh.length) peerRequests.set(key, fresh);
    else peerRequests.delete(key);
  }
}, 60000).unref();

const port = Number(process.env.PORT) || 5173;
server.listen(port, "0.0.0.0", () => {
  console.log(`WOLVGUARD API server listening on port ${port}.`);
});
