import type { Clock, PricePolicy } from "../../core/src/types.ts";
import { createRunId } from "../../core/src/ids.ts";
import {
  agentRunRequestSchema,
  agentRunSchema,
  opportunityCandidateInputSchema,
  type AgentRun,
  type AgentRunRequest,
  type AgentSourceState,
  type OpportunityCandidateInput
} from "./schema.ts";
import { scoreOpportunity } from "./scoring.ts";

export interface AgentSourceBundle {
  candidates: OpportunityCandidateInput[];
  sources: AgentSourceState[];
  warnings?: string[];
}

export interface AgentRuntime {
  clock: Clock;
  createId?: () => string;
}

function planFor(
  request: AgentRunRequest,
  sources: AgentSourceState[],
  candidateCount: number
): AgentRun["plan"] {
  const failures = sources.filter(
    (source) => source.status === "FAILED" || source.status === "UNAVAILABLE"
  ).length;
  return [
    {
      id: "PLAN_THEME",
      title: "테마와 승인 조건 설정",
      status: "COMPLETED",
      detail: `${request.theme} 테마를 ${request.mode} 모드로 분석합니다.`
    },
    {
      id: "COLLECT_SOURCES",
      title: "허용된 데이터원 수집",
      status: failures ? "PARTIAL" : "COMPLETED",
      detail: `${sources.length}개 데이터원 중 ${failures}개가 사용 불가 또는 실패했습니다.`
    },
    {
      id: "NORMALIZE_CANDIDATES",
      title: "후보 상품 표준화",
      status: candidateCount ? "COMPLETED" : "FAILED",
      detail: `${candidateCount}개 상품 후보를 표준 입력으로 정리했습니다.`
    },
    {
      id: "SCORE_OPPORTUNITIES",
      title: "시장성·수익성·공급·운영 점수화",
      status: candidateCount ? "COMPLETED" : "SKIPPED",
      detail: "규정 적합성은 점수와 분리된 차단 조건으로 평가합니다."
    },
    {
      id: "HUMAN_APPROVAL",
      title: "사람의 최종 승인",
      status: candidateCount ? "COMPLETED" : "SKIPPED",
      detail: "에이전트는 후보와 작업목록만 만들며 외부 판매 등록은 수행하지 않습니다."
    }
  ];
}

export function runOpportunityAgent(
  rawRequest: AgentRunRequest,
  rawBundle: AgentSourceBundle,
  pricePolicy: PricePolicy,
  runtime: AgentRuntime
): AgentRun {
  const request = agentRunRequestSchema.parse(rawRequest);
  const candidates = rawBundle.candidates
    .map((candidate) => opportunityCandidateInputSchema.parse(candidate))
    .filter((candidate) => candidate.theme === request.theme);

  const ranked = candidates
    .map((candidate) => scoreOpportunity(candidate, request.sellerProfile, pricePolicy))
    .sort((left, right) => {
      if (left.gate === "BLOCKED" && right.gate !== "BLOCKED") return 1;
      if (right.gate === "BLOCKED" && left.gate !== "BLOCKED") return -1;
      return right.scores.overallScore - left.scores.overallScore;
    })
    .slice(0, request.topN)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const sourceFailures = rawBundle.sources.filter(
    (source) => source.status === "FAILED" || source.status === "UNAVAILABLE"
  ).length;
  const executionStatus =
    ranked.length === 0 ? "FAILED" : sourceFailures > 0 ? "PARTIAL" : "COMPLETED";

  const warnings = [...(rawBundle.warnings ?? [])];
  if (request.mode === "DEMO") {
    warnings.push("데모 데이터는 실제 최신 시장수요를 의미하지 않습니다.");
  }
  if (request.mode === "LIVE" && sourceFailures > 0) {
    warnings.push("일부 실시간 데이터원을 사용할 수 없어 결과 신뢰도가 낮아질 수 있습니다.");
  }
  warnings.push("에이전트는 판매를 자동 실행하지 않으며 모든 후보는 사람의 승인이 필요합니다.");

  const run: AgentRun = {
    schemaVersion: "1.0.0",
    id: runtime.createId?.() ?? `agent-${createRunId()}`,
    createdAt: runtime.clock.now().toISOString(),
    theme: request.theme,
    mode: request.mode,
    executionStatus,
    approvalStatus: "AWAITING_APPROVAL",
    approvedCandidateIds: [],
    noExternalWrite: true,
    pricePolicy,
    plan: planFor(request, rawBundle.sources, candidates.length),
    sources: rawBundle.sources,
    candidates: ranked,
    summary: {
      collectedCandidates: candidates.length,
      priorityReview: ranked.filter(
        (candidate) => candidate.recommendation === "PRIORITY_REVIEW"
      ).length,
      blocked: ranked.filter((candidate) => candidate.gate === "BLOCKED").length,
      sourceFailures
    },
    warnings: [...new Set(warnings)]
  };

  return agentRunSchema.parse(run);
}

export function approveAgentCandidates(
  run: AgentRun,
  candidateIds: string[],
  approvedAt: Date
): AgentRun {
  const allowed = new Set(
    run.candidates
      .filter((candidate) => candidate.gate !== "BLOCKED")
      .map((candidate) => candidate.candidateId)
  );
  const approvedCandidateIds = [...new Set(candidateIds)].filter((id) => allowed.has(id));
  return agentRunSchema.parse({
    ...run,
    approvalStatus: approvedCandidateIds.length ? "APPROVED" : "REJECTED",
    approvedCandidateIds,
    approvedAt: approvedAt.toISOString()
  });
}
