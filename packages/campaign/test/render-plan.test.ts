import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildRenderPlan, RenderPlanError, formatKrw } from "../src/index.ts";

const demo = JSON.parse(
  readFileSync(new URL("../../../fixtures/render/demo-campaign.json", import.meta.url), "utf8")
);

test("렌더 계획: 결정적 씬 타입 유추(마지막 CTA, 그 앞 PRICE, 나머지 켄번즈)", () => {
  const plan = buildRenderPlan(demo, demo.creatives[2].id);
  const types = plan.scenes.map((s) => s.sceneType);
  assert.equal(types.at(-1), "CTA_CARD");
  assert.equal(types.at(-2), "PRICE_CARD");
  assert.ok(types.slice(0, -2).every((t) => t === "PRODUCT_KENBURNS"));
  assert.equal(plan.width, 720);
  assert.equal(plan.height, 1280);
  assert.equal(plan.totalDurationSeconds, 15);
});

test("렌더 계획: 가격카드 값은 캠페인 offer에서만 파생 (FACT_SOURCE_MISMATCH 예방)", () => {
  const plan = buildRenderPlan(demo, demo.creatives[0].id);
  const price = plan.scenes.find((s) => s.sceneType === "PRICE_CARD")?.priceCard;
  assert.ok(price);
  assert.equal(price.sellPriceKrw, demo.offer.sellPrice);
  assert.equal(price.listPriceKrw, demo.offer.listPrice);
  assert.equal(price.productTitle, demo.input.product.title);
  assert.equal(price.originDisplay, demo.input.product.originDisplay);
});

test("렌더 계획: CTA 카드에 표시광고 고지 문구가 포함된다", () => {
  const plan = buildRenderPlan(demo, demo.creatives[0].id);
  const cta = plan.scenes.find((s) => s.sceneType === "CTA_CARD")?.ctaCard;
  assert.ok(cta);
  assert.equal(cta.disclosureText, demo.creatives[0].disclosureText);
  assert.equal(cta.callToAction, demo.offer.callToAction);
});

test("렌더 계획: 미승인 캠페인은 거부된다", () => {
  const draft = structuredClone(demo);
  draft.approvalStatus = "AWAITING_APPROVAL";
  assert.throws(
    () => buildRenderPlan(draft, demo.creatives[0].id),
    (e: unknown) => e instanceof RenderPlanError && e.code === "CAMPAIGN_NOT_APPROVED"
  );
});

test("렌더 계획: BLOCKED 이슈가 있으면 거부된다", () => {
  const blocked = structuredClone(demo);
  blocked.safetyIssues = [
    { code: "IMAGE_RIGHTS_NOT_CONFIRMED", severity: "BLOCKED", message: "x", fix: "y" }
  ];
  assert.throws(
    () => buildRenderPlan(blocked, demo.creatives[0].id),
    (e: unknown) => e instanceof RenderPlanError && e.code === "CAMPAIGN_BLOCKED"
  );
});

test("렌더 계획: 없는 크리에이티브는 거부된다", () => {
  assert.throws(
    () => buildRenderPlan(demo, "NOPE"),
    (e: unknown) => e instanceof RenderPlanError && e.code === "CREATIVE_NOT_FOUND"
  );
});

test("원화 표기", () => {
  assert.equal(formatKrw(19900), "19,900원");
  assert.equal(formatKrw(0), "0원");
});
