import type { IncomingMessage, ServerResponse } from "node:http";
import { issuesCsv, renderStandaloneHtml } from "../../../packages/core/src/index.ts";
import { store } from "./context.ts";
import { sendJson, sendText } from "./http-utils.ts";

export function handleArtifactApi(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "runs" || !segments[2] || req.method !== "GET") return false;
  const artifact = segments[3];
  if (!["report.json", "report.html", "issues.csv", "payloads.json"].includes(artifact)) return false;
  const found = store.get(segments[2]);
  if (!found) { sendJson(res, 404, { error: { code: "RUN_NOT_FOUND", message: "진단 이력을 찾을 수 없습니다." } }); return true; }
  if (artifact === "report.json") sendText(res, 200, JSON.stringify(found.report, null, 2), "application/json; charset=utf-8");
  else if (artifact === "report.html") sendText(res, 200, renderStandaloneHtml(found.report), "text/html; charset=utf-8");
  else if (artifact === "issues.csv") sendText(res, 200, issuesCsv(found.report), "text/csv; charset=utf-8");
  else sendText(res, 200, JSON.stringify(found.report.items.map((item) => ({ supplierSku: item.supplierSku,
    preview: item.coupangPayloadPreview })), null, 2), "application/json; charset=utf-8");
  return true;
}
