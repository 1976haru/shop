import type { IncomingMessage, ServerResponse } from "node:http";
import { diagnoseCsv, systemClock, diffReports, patchSourceRow } from "../../../packages/core/src/index.ts";
import type { PricePolicy } from "../../../packages/core/src/types.ts";
import { store, metadata, defaultPolicy, demoCsv } from "./context.ts";
import { readJsonBody, sendJson, sendText } from "./http-utils.ts";

export async function handleBasicApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const path = url.pathname;
  if (path === "/health/live") { sendJson(res, 200, { status: "ok" }); return true; }
  if (path === "/health/ready") { sendJson(res, 200, { status: "ready", metadata: metadata.version }); return true; }
  if (path === "/api/demo.csv") { sendText(res, 200, demoCsv, "text/csv; charset=utf-8"); return true; }
  if (path === "/api/runs" && req.method === "GET") { sendJson(res, 200, { runs: store.list() }); return true; }
  if (path === "/api/diagnose" && req.method === "POST") {
    const input = await readJsonBody(req);
    if (typeof input.csvText !== "string" || !input.csvText.trim()) throw new Error("CSV 파일 내용이 필요합니다.");
    const policy = { ...defaultPolicy, ...(input.pricePolicy ?? {}) } as PricePolicy;
    const report = diagnoseCsv({ csvText: input.csvText, filename: input.filename ?? "upload.csv",
      metadata, pricePolicy: policy, clock: systemClock(), maxRows: Number(process.env.MAX_INPUT_ROWS ?? 5000) });
    store.save(report, input.csvText);
    sendJson(res, 201, report);
    return true;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "runs" || !segments[2]) return false;
  const found = store.get(segments[2]);
  if (!found) { sendJson(res, 404, { error: { code: "RUN_NOT_FOUND", message: "진단 이력을 찾을 수 없습니다." } }); return true; }
  if (segments.length === 3 && req.method === "GET") { sendJson(res, 200, found.report); return true; }
  if (segments.length === 3 && req.method === "DELETE") { store.delete(segments[2]); sendJson(res, 200, { deleted: true }); return true; }
  if (segments[3] === "patch" && req.method === "POST") {
    const input = await readJsonBody(req);
    const csv = patchSourceRow(found.report, Number(input.itemIndex), String(input.field), String(input.value));
    const report = diagnoseCsv({ csvText: csv, filename: found.report.run.inputFilename,
      metadata, pricePolicy: defaultPolicy, clock: systemClock() });
    store.save(report, csv);
    sendJson(res, 201, report);
    return true;
  }
  if (segments[3] === "diff" && req.method === "GET") {
    const base = store.get(url.searchParams.get("baseRunId") ?? "");
    if (!base) { sendJson(res, 404, { error: { code: "RUN_NOT_FOUND", message: "비교할 진단 이력을 찾을 수 없습니다." } }); return true; }
    sendJson(res, 200, diffReports(base.report, found.report));
    return true;
  }
  return false;
}
