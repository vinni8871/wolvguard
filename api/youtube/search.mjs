import { handleApi } from "../../server/handler.mjs";

export default async function handler(req, res) {
  return handleApi(req, res, "/api/youtube/search");
}
