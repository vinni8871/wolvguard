import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi, cache, peerRequests } from "./handler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
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

export { server, handleApi };
