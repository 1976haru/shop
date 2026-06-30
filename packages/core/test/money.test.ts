import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrice } from "../src/money.ts";

test("basis point 가격 골든 값", () => {
  const result = calculatePrice({ cost: 12000, supplierShipFee: 0, fixedCost: 0, platformFeeBp: 1080,
    adReserveBp: 500, returnReserveBp: 200, paymentReserveBp: 0,
    targetContributionMarginBp: 2000, roundingMode: "END_900" });
  assert.equal(result.rawRequiredPrice, 19293);
  assert.equal(result.sellPrice, 19900);
  assert.equal(result.contributionProfit, 4358);
  assert.equal(result.contributionMarginBp, 2190);
});

test("불가능한 가격 정책은 차단", () => {
  const result = calculatePrice({ cost: 1000, supplierShipFee: 0, fixedCost: 0, platformFeeBp: 8000,
    adReserveBp: 1000, returnReserveBp: 0, paymentReserveBp: 0,
    targetContributionMarginBp: 2000, roundingMode: "NONE" });
  assert.equal(result.verdict, "BLOCKED");
  assert.ok(result.denominatorBp <= 0);
});
