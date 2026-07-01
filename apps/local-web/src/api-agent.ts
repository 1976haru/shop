import type { IncomingMessage, ServerResponse } from "node:http";
import { runOpportunityAgent, approveAgentCandidates } from "../../../packages/agent/src/orchestrator.ts";
import { agentRunRequestSchema } from "../../../packages/agent/src/schema.ts";
import { systemClock } from "../../../packages/core/src/time.ts";
import { defaultPolicy, store } from "./context.ts";
import { collectAgentSources, getAgentCapabilities } from "./agent-sources.ts";
import { readJsonBody, sendJson } from "./http-utils.ts";

export async function handleAgentApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const path = url.pathname;

  if (path === "/api/agent/capabilities" && req.method === "GET") {
    sendJson(res, 200, getAgentCapabilities());
    return true;
  }

  if (path === "/api/agent/runs" && req.method === "GET") {
    sendJson(res, 200, { runs: store.listAgentRuns() });
    return true;
  }

  if (path === "/api/agent/run" && req.method === "POST") {
    const body = await readJsonBody(req);
    const request = agentRunRequestSchema.parse(body);
    const bundle = await collectAgentSources(request);
    const run = runOpportunityAgent(request, bundle, defaultPolicy, {
      clock: systemClock()
    });
    store.saveAgentRun(run);
    sendJson(res, 201, run);
    return true;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "agent" || segments[2] !== "runs" || !segments[3]) {
    return false;
  }

  const id = segments[3];
  const run = store.getAgentRun(id);
  if (!run) {
    sendJson(res, 404, {
      error: {
        code: "AGENT_RUN_NOT_FOUND",
        message: "에이전트 실행 이력을 찾을 수 없습니다."
      }
    });
    return true;
  }

  if (segments.length === 4 && req.method === "GET") {
    sendJson(res, 200, run);
    return true;
  }

  if (segments.length === 4 && req.method === "DELETE") {
    store.deleteAgentRun(id);
    sendJson(res, 200, { deleted: true });
    return true;
  }

  if (segments[4] === "approve" && req.method === "POST") {
    const body = await readJsonBody(req);
    const ids = Array.isArray(body.candidateIds)
      ? body.candidateIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const approved = approveAgentCandidates(run, ids, new Date());
    store.saveAgentRun(approved);
    sendJson(res, 200, approved);
    return true;
  }

  return false;
}
