import { handleApi } from "../server/handler.mjs";

export default async function handler(req, res) {
  let pathname = new URL(req.url || "/", "http://localhost").pathname;
  if ((pathname === "/api" || pathname === "/api/") && req.query?.path) {
    pathname = "/api/" + (Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path);
  }
  return handleApi(req, res, pathname);
}
