import assert from "node:assert/strict";
import test from "node:test";
import { generateCampaign } from "../src/index.ts";

test("campaign generator creates three variants", () => {
  const campaign = generateCampaign({
    campaignName: "test campaign",
    objective: "CONVERSION",
    targetAudience: "online shoppers",
    tone: "TRUSTWORTHY",
    durationSeconds: 30,
    channels: ["YOUTUBE_SHORTS"],
    disclosureType: "DIRECT_SALE",
    forbiddenClaims: [],
    evidence: {
      originConfirmed: true,
      imageRightsConfirmed: true,
      factsConfirmed: true
    },
    product: {
      sourceRunId: "RUN-1",
      sourceItemIndex: 0,
      supplierSku: "SKU-1",
      title: "sample product",
      manufacturer: "sample maker",
      originDisplay: "KR",
      optionSummary: "3kg",
      sellPrice: 29900,
      compliancePack: "AGRI_KR"
    }
  }, {
    id: "CMP-1",
    now: "2026-07-02T00:00:00.000Z"
  });

  assert.equal(campaign.creatives.length, 3);
});
