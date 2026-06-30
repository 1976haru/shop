import type { PricePolicy, PriceResult, Verdict } from "./types.ts";

const MONEY_MAX_KRW = 1_000_000_000;

function assertMoney(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MONEY_MAX_KRW) {
    throw new Error(`${field}는 0원 이상 ${MONEY_MAX_KRW.toLocaleString("ko-KR")}원 이하의 정수여야 합니다.`);
  }
}

function ceilDiv(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator)) throw new Error("금액 계산이 안전한 정수 범위를 초과했습니다.");
  return Math.floor((numerator + denominator - 1) / denominator);
}

function roundPrice(value: number, mode: PricePolicy["roundingMode"]): number {
  if (mode === "NONE") return value;
  if (mode === "CEIL_100") return Math.ceil(value / 100) * 100;
  const ending = mode === "END_900" ? 900 : 990;
  const candidate = Math.floor(value / 1000) * 1000 + ending;
  return candidate >= value ? candidate : candidate + 1000;
}

export function calculatePrice(policy: PricePolicy): PriceResult {
  assertMoney(policy.cost, "원가");
  assertMoney(policy.supplierShipFee, "공급처 배송비");
  assertMoney(policy.fixedCost, "고정비");
  const rates = [policy.platformFeeBp, policy.adReserveBp, policy.returnReserveBp,
    policy.paymentReserveBp, policy.targetContributionMarginBp];
  if (rates.some((value) => !Number.isInteger(value) || value < 0 || value > 10_000)) {
    throw new Error("요율은 0~10,000bp 정수여야 합니다.");
  }
  const baseCost = policy.cost + policy.supplierShipFee + policy.fixedCost;
  const variableFeeBp = policy.platformFeeBp + policy.adReserveBp + policy.returnReserveBp + policy.paymentReserveBp;
  const denominatorBp = 10_000 - variableFeeBp - policy.targetContributionMarginBp;
  if (denominatorBp <= 0) {
    return { baseCost, variableFeeBp, denominatorBp, rawRequiredPrice: 0, sellPrice: 0,
      listPrice: 0, estimatedVariableCost: 0, contributionProfit: -baseCost,
      contributionMarginBp: -10_000, verdict: "BLOCKED", calculationVersion: "1.1.0" };
  }
  const rawRequiredPrice = ceilDiv(baseCost * 10_000, denominatorBp);
  const sellPrice = roundPrice(rawRequiredPrice, policy.roundingMode);
  const estimatedVariableCost = Math.round((sellPrice * variableFeeBp) / 10_000);
  const contributionProfit = sellPrice - baseCost - estimatedVariableCost;
  const contributionMarginBp = sellPrice > 0 ? Math.round((contributionProfit * 10_000) / sellPrice) : -10_000;
  let verdict: Verdict = "PASS";
  if (contributionProfit < 0 || (policy.minPriceFloor !== undefined && sellPrice < policy.minPriceFloor)) verdict = "BLOCKED";
  else if (contributionMarginBp < 500) verdict = "WARNING";
  return { baseCost, variableFeeBp, denominatorBp, rawRequiredPrice, sellPrice, listPrice: sellPrice,
    estimatedVariableCost, contributionProfit, contributionMarginBp, verdict, calculationVersion: "1.1.0" };
}
