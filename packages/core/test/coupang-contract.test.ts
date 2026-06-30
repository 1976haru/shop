import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { diagnoseCsv } from "../src/pipeline.ts";
import { fixedClock } from "../src/time.ts";
import type { MetadataSnapshot, PricePolicy } from "../src/types.ts";

const metadata = JSON.parse(
  await readFile("fixtures/coupang-meta/agri.fixture.json", "utf8")
) as MetadataSnapshot;
const policy = JSON.parse(
  await readFile("fixtures/policies/local-default.json", "utf8")
) as PricePolicy;
const contract = JSON.parse(
  await readFile("fixtures/coupang-contract/product-create.contract.json", "utf8")
) as {
  adultOnly: string[];
  taxType: string[];
  parallelImported: string[];
  overseasPurchased: string[];
  requestedPreviewDefault: boolean;
};
const csv = await readFile("fixtures/slice0/normal-agri.csv", "utf8");

test("payload preview 기본 enum이 계약 fixture 범위에 있다", () => {
  const report = diagnoseCsv({
    csvText: csv,
    filename: "normal.csv",
    metadata,
    pricePolicy: policy,
    clock: fixedClock("2026-06-30T12:00:00Z"),
    runId: "fixed-run"
  });
  const request = report.items[0].coupangPayloadPreview?.requestBody as {
    requested?: boolean;
    items?: Array<{
      adultOnly?: string;
      taxType?: string;
      parallelImported?: string;
      overseasPurchased?: string;
    }>;
  };
  const item = request.items?.[0];
  assert.equal(request.requested, contract.requestedPreviewDefault);
  assert.ok(contract.adultOnly.includes(item?.adultOnly ?? ""));
  assert.ok(contract.taxType.includes(item?.taxType ?? ""));
  assert.ok(contract.parallelImported.includes(item?.parallelImported ?? ""));
  assert.ok(contract.overseasPurchased.includes(item?.overseasPurchased ?? ""));
});
