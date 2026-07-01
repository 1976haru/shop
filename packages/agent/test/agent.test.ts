import assert from "node:assert/strict";
import test from "node:test";
import { fixedClock } from "../../core/src/time.ts";
import type { PricePolicy } from "../../core/src/types.ts";
import {
  approveAgentCandidates,
  runOpportunityAgent
} from "../src/orchestrator.ts";
import type {
  AgentRunRequest,
  AgentSourceState,
  OpportunityCandidateInput
} from "../src/schema.ts";

const pricePolicy: PricePolicy = {
  cost: 0,
  supplierShipFee: 0,
  fixedCost: 0,
  platformFeeBp: 1080,
  adReserveBp: 500,
  returnReserveBp: 200,
  paymentReserveBp: 0,
  targetContributionMarginBp: 2000,
  roundingMode: "END_900"
};

const source: AgentSourceState = {
  source: "FIXTURE",
  status: "USED",
  message: "test",
  collectedAt: "2026-07-01T00:00:00Z",
  recordCount: 2
};

function candidate(overrides: Partial<OpportunityCandidateInput> = {}): OpportunityCandidateInput {
  return {
    id: "candidate-1",
    theme: "AGRI_KR",
    name: "국산 혼합잡곡 2kg",
    keywords: ["잡곡"],
    cost: 12000,
    supplierShipFee: 2500,
    fixedCost: 500,
    marketPrice: 26900,
    stock: 100,
    demandTrendScore: 80,
    seasonalityScore: 75,
    competitionAttractivenessScore: 70,
    priceStabilityScore: 82,
    supplyStabilityScore: 84,
    operationEaseScore: 88,
    shippingRiskScore: 15,
    complianceGate: "PASS",
    complianceReasons: [],
    evidence: [{
      source: "FIXTURE",
      label: "test evidence",
      capturedAt: "2026-07-01T00:00:00Z",
      freshness: "FIXTURE"
    }],
    ...overrides
  };
}

function request(overrides: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    theme: "AGRI_KR",
    mode: "DEMO",
    topN: 10,
    sellerProfile: {
      healthSupplementBusinessReported: false,
      imageRightsConfirmed: true,
      originEvidenceAvailable: true
    },
    ...overrides
  };
}

test("유망 후보를 점수화하고 사람 승인 대기로 남긴다", () => {
  const run = runOpportunityAgent(
    request(),
    { candidates: [candidate()], sources: [source] },
    pricePolicy,
    {
      clock: fixedClock("2026-07-01T00:00:00Z"),
      createId: () => "agent-test"
    }
  );

  assert.equal(run.id, "agent-test");
  assert.equal(run.noExternalWrite, true);
  assert.equal(run.approvalStatus, "AWAITING_APPROVAL");
  assert.equal(run.candidates[0]?.humanApprovalRequired, true);
  assert.ok((run.candidates[0]?.scores.overallScore ?? 0) >= 70);
});

test("건강기능식품 판매업 신고 미확인은 점수와 무관하게 차단한다", () => {
  const run = runOpportunityAgent(
    request({
      theme: "HEALTH_SUPPLEMENT_KR",
      sellerProfile: {
        healthSupplementBusinessReported: false,
        imageRightsConfirmed: true,
        originEvidenceAvailable: true
      }
    }),
    {
      candidates: [candidate({
        id: "supplement-1",
        theme: "HEALTH_SUPPLEMENT_KR",
        name: "비타민D 건강기능식품",
        keywords: ["비타민D"]
      })],
      sources: [source]
    },
    pricePolicy,
    {
      clock: fixedClock("2026-07-01T00:00:00Z"),
      createId: () => "agent-supplement"
    }
  );

  assert.equal(run.candidates[0]?.gate, "BLOCKED");
  assert.equal(run.candidates[0]?.recommendation, "BLOCKED");
  assert.ok(
    run.candidates[0]?.gateReasons.some((reason) => reason.includes("일반판매업 신고"))
  );
});

test("일부 데이터원 실패는 PARTIAL로 기록하고 후보 분석은 유지한다", () => {
  const run = runOpportunityAgent(
    request({ mode: "LIVE" }),
    {
      candidates: [candidate()],
      sources: [
        source,
        {
          source: "NAVER_TREND",
          status: "FAILED",
          message: "temporary failure",
          recordCount: 0
        }
      ]
    },
    pricePolicy,
    {
      clock: fixedClock("2026-07-01T00:00:00Z"),
      createId: () => "agent-partial"
    }
  );

  assert.equal(run.executionStatus, "PARTIAL");
  assert.equal(run.summary.sourceFailures, 1);
  assert.equal(run.candidates.length, 1);
});

test("BLOCKED 후보는 승인 목록에서 제외한다", () => {
  const run = runOpportunityAgent(
    request({ theme: "HEALTH_SUPPLEMENT_KR" }),
    {
      candidates: [candidate({
        id: "blocked",
        theme: "HEALTH_SUPPLEMENT_KR",
        complianceGate: "BLOCKED"
      })],
      sources: [source]
    },
    pricePolicy,
    {
      clock: fixedClock("2026-07-01T00:00:00Z"),
      createId: () => "agent-approval"
    }
  );
  const approved = approveAgentCandidates(run, ["blocked"], new Date("2026-07-01T01:00:00Z"));
  assert.equal(approved.approvalStatus, "REJECTED");
  assert.deepEqual(approved.approvedCandidateIds, []);
});
