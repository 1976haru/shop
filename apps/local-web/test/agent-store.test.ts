import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AgentRun } from "../../../packages/agent/src/schema.ts";
import { RunStore } from "../src/store.ts";

const run: AgentRun = {
  schemaVersion: "1.0.0",
  id: "agent-store-test",
  createdAt: "2026-07-01T00:00:00Z",
  theme: "AGRI_KR",
  mode: "DEMO",
  executionStatus: "COMPLETED",
  approvalStatus: "AWAITING_APPROVAL",
  approvedCandidateIds: [],
  noExternalWrite: true,
  pricePolicy: {
    cost: 0,
    supplierShipFee: 0,
    fixedCost: 0,
    platformFeeBp: 1080,
    adReserveBp: 500,
    returnReserveBp: 200,
    paymentReserveBp: 0,
    targetContributionMarginBp: 2000,
    roundingMode: "END_900"
  },
  plan: [],
  sources: [],
  candidates: [],
  summary: {
    collectedCandidates: 0,
    priorityReview: 0,
    blocked: 0,
    sourceFailures: 0
  },
  warnings: []
};

test("에이전트 실행과 승인상태를 저장한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shop-agent-store-"));
  const store = new RunStore(join(directory, "runs.sqlite"));
  store.saveAgentRun(run);
  assert.equal(store.getAgentRun(run.id)?.approvalStatus, "AWAITING_APPROVAL");
  assert.equal(store.listAgentRuns()[0]?.theme, "AGRI_KR");
  assert.equal(store.deleteAgentRun(run.id), true);
  await rm(directory, { recursive: true, force: true });
});
