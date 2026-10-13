import { handleApi } from "../server/handler.mjs";

export default async function handler(req, res) {
  const rawPath = req.headers["x-matched-path"] || req.url || "/api/providers";
  let pathname = new URL(rawPath, "http://localhost").pathname;
  if (pathname === "/api" || pathname === "/api/") {
    if (Array.isArray(req.query?.path)) {
      pathname = "/api/" + req.query.path.join("/");
    } else if (typeof req.query?.path === "string") {
      pathname = "/api/" + req.query.path;
    } else {
      pathname = "/api/providers";
    }
  }
  return handleApi(req, res, pathname);
}
