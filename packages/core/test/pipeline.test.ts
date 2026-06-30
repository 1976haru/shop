import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { diagnoseCsv } from "../src/pipeline.ts";
import { fixedClock } from "../src/time.ts";
import type { MetadataSnapshot, PricePolicy } from "../src/types.ts";

const metadata = JSON.parse(await readFile("fixtures/coupang-meta/agri.fixture.json", "utf8")) as MetadataSnapshot;
const policy = JSON.parse(await readFile("fixtures/policies/local-default.json", "utf8")) as PricePolicy;
const csv = await readFile("fixtures/slice0/normal-agri.csv", "utf8");

test("Slice-0 정상 농산물 진단", () => {
  const report = diagnoseCsv({ csvText: csv, filename: "normal-agri.csv", metadata, pricePolicy: policy,
    clock: fixedClock("2026-06-30T12:00:00Z"), runId: "fixed-run" });
  assert.equal(report.summary.processed, 1);
  assert.equal(report.items[0].price?.sellPrice, 19900);
  assert.equal(report.items[0].verdict, "WARNING");
  assert.equal(report.items[0].coupangPayloadPreview?.nonExecutable, true);
  assert.equal((report.items[0].coupangPayloadPreview?.requestBody as any)?.requested, false);
  assert.equal(report.items[0].coupangPayloadPreview?.publishReady, false);
});

test("동일 입력과 고정 시계는 동일 결과", () => {
  const input = { csvText: csv, filename: "x.csv", metadata, pricePolicy: policy,
    clock: fixedClock("2026-06-30T12:00:00Z"), runId: "fixed-run" };
  assert.deepEqual(diagnoseCsv(input), diagnoseCsv(input));
});
