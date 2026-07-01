import { calculatePrice } from "../../core/src/money.ts";
import type { PricePolicy } from "../../core/src/types.ts";
import type {
  AgentSellerProfile,
  OpportunityCandidateInput,
  OpportunityResult
} from "./schema.ts";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function marginScore(marginBp: number | undefined): number {
  if (marginBp === undefined) return 40;
  if (marginBp < 0) return 0;
  if (marginBp < 500) return 20;
  if (marginBp < 1_000) return 45;
  if (marginBp < 1_500) return 65;
  if (marginBp < 2_000) return 80;
  return 100;
}

function recommendation(overallScore: number, blocked: boolean): OpportunityResult["recommendation"] {
  if (blocked) return "BLOCKED";
  if (overallScore >= 80) return "PRIORITY_REVIEW";
  if (overallScore >= 70) return "NEGOTIATE_OR_IMPROVE";
  if (overallScore >= 60) return "WATCHLIST";
  return "EXCLUDE";
}

function complianceGate(
  candidate: OpportunityCandidateInput,
  sellerProfile: AgentSellerProfile
): { gate: OpportunityResult["gate"]; reasons: string[] } {
  const reasons = [...candidate.complianceReasons];
  let gate = candidate.complianceGate;

  if (
    candidate.theme === "HEALTH_SUPPLEMENT_KR" &&
    !sellerProfile.healthSupplementBusinessReported
  ) {
    gate = "BLOCKED";
    reasons.push("건강기능식품 일반판매업 신고 확인이 필요합니다.");
  }
  if (!sellerProfile.imageRightsConfirmed) {
    if (gate === "PASS") gate = "WARNING";
    reasons.push("상품 이미지 사용권을 확인해야 합니다.");
  }
  if (candidate.theme === "AGRI_KR" && !sellerProfile.originEvidenceAvailable) {
    if (gate === "PASS") gate = "WARNING";
    reasons.push("농산물 원산지 증빙을 확인해야 합니다.");
  }
  if (!candidate.evidence.length) {
    if (gate === "PASS") gate = "WARNING";
    reasons.push("판단 근거 데이터가 없어 추가 확인이 필요합니다.");
  }

  return { gate, reasons: [...new Set(reasons)] };
}

export function scoreOpportunity(
  candidate: OpportunityCandidateInput,
  sellerProfile: AgentSellerProfile,
  basePolicy: PricePolicy
): Omit<OpportunityResult, "rank"> {
  const marketScore = clampScore(
    candidate.demandTrendScore * 0.4 +
      candidate.seasonalityScore * 0.25 +
      candidate.competitionAttractivenessScore * 0.2 +
      candidate.priceStabilityScore * 0.15
  );

  let requiredSellPrice: number | undefined;
  let estimatedMarginBp: number | undefined;
  if (candidate.cost !== undefined) {
    const price = calculatePrice({
      ...basePolicy,
      cost: candidate.cost,
      supplierShipFee: candidate.supplierShipFee,
      fixedCost: candidate.fixedCost
    });
    requiredSellPrice = price.sellPrice;
    if (candidate.marketPrice !== undefined && candidate.marketPrice > 0) {
      const baseCost = candidate.cost + candidate.supplierShipFee + candidate.fixedCost;
      const variableCost = Math.round(
        (candidate.marketPrice * price.variableFeeBp) / 10_000
      );
      const contribution = candidate.marketPrice - baseCost - variableCost;
      estimatedMarginBp = Math.round((contribution * 10_000) / candidate.marketPrice);
    } else {
      estimatedMarginBp = price.contributionMarginBp;
    }
  }

  const profitScore = marginScore(estimatedMarginBp);
  const stockScore =
    candidate.stock === undefined ? 60 : candidate.stock === 0 ? 0 : candidate.stock < 10 ? 40 : 100;
  const supplyScore = clampScore(
    average([candidate.supplyStabilityScore, candidate.priceStabilityScore, stockScore])
  );
  const operationScore = clampScore(
    average([candidate.operationEaseScore, 100 - candidate.shippingRiskScore])
  );
  const overallScore = clampScore(
    marketScore * 0.35 + profitScore * 0.25 + supplyScore * 0.2 + operationScore * 0.2
  );

  const gateResult = complianceGate(candidate, sellerProfile);
  const blocked = gateResult.gate === "BLOCKED";
  const whyRecommended: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  if (marketScore >= 70) whyRecommended.push("시장·계절·경쟁 신호가 양호합니다.");
  if (profitScore >= 70) whyRecommended.push("현재 입력 기준 예상 마진이 양호합니다.");
  if (supplyScore >= 70) whyRecommended.push("공급과 가격 안정성이 비교적 높습니다.");
  if (operationScore >= 70) whyRecommended.push("배송·운영 난이도가 비교적 낮습니다.");
  if (candidate.marketPrice !== undefined && requiredSellPrice !== undefined) {
    if (candidate.marketPrice < requiredSellPrice) {
      risks.push("시장가격이 목표마진을 충족하는 최소 판매가보다 낮습니다.");
      nextActions.push("공급가 협상 또는 구성·용량 조정을 검토하세요.");
    } else {
      nextActions.push("시장가격과 권장 판매가의 차이를 최종 확인하세요.");
    }
  } else {
    risks.push("원가 또는 시장가격이 없어 수익성 점수의 신뢰도가 낮습니다.");
    nextActions.push("공급가와 비교 가능한 시장가격을 입력하세요.");
  }
  if (candidate.shippingRiskScore >= 60) {
    risks.push("파손·신선도·냉장배송 등 배송 위험이 높습니다.");
    nextActions.push("포장비, 반품률, 도서산간 배송정책을 확인하세요.");
  }
  if (candidate.competitionAttractivenessScore < 45) {
    risks.push("경쟁 강도가 높을 가능성이 있습니다.");
    nextActions.push("차별화 구성, 산지·원료 근거, 리뷰 확보 전략을 검토하세요.");
  }
  nextActions.push(...gateResult.reasons.map((reason) => `확인: ${reason}`));
  nextActions.push("사람이 근거와 상품정보를 검토한 뒤 승인하세요.");

  return {
    candidateId: candidate.id,
    theme: candidate.theme,
    name: candidate.name,
    ...(candidate.supplierSku ? { supplierSku: candidate.supplierSku } : {}),
    gate: gateResult.gate,
    gateReasons: gateResult.reasons,
    recommendation: recommendation(overallScore, blocked),
    scores: {
      marketScore,
      profitScore,
      supplyScore,
      operationScore,
      overallScore,
      ...(estimatedMarginBp !== undefined ? { estimatedMarginBp } : {}),
      ...(requiredSellPrice !== undefined ? { requiredSellPrice } : {}),
      ...(candidate.marketPrice !== undefined ? { marketPrice: candidate.marketPrice } : {})
    },
    whyRecommended,
    risks,
    nextActions: [...new Set(nextActions)],
    evidence: candidate.evidence,
    humanApprovalRequired: true
  };
}
