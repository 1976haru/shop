import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createInternalCode } from "../src/ids.ts";
import { diagnoseCsv } from "../src/pipeline.ts";
import { fixedClock } from "../src/time.ts";
import type { MetadataSnapshot, PricePolicy } from "../src/types.ts";

const metadata = JSON.parse(
  await readFile("fixtures/coupang-meta/agri.fixture.json", "utf8")
) as MetadataSnapshot;
const policy = JSON.parse(
  await readFile("fixtures/policies/local-default.json", "utf8")
) as PricePolicy;
const normalCsv = await readFile("fixtures/slice0/normal-agri.csv", "utf8");

function replaceCsvColumn(row: string, header: string, value: string): string {
  const lines = normalCsv.trimEnd().split("\n");
  const headers = lines[0].split(",");
  const values = row.split(",");
  const index = headers.indexOf(header);
  assert.notEqual(index, -1);
  values[index] = value;
  return values.join(",");
}

test("잘못된 한 행을 격리하고 다음 행을 계속 진단한다", () => {
  const lines = normalCsv.trimEnd().split("\n");
  const invalidRow = replaceCsvColumn(lines[1], "cost", "-1");
  const mixedCsv = [lines[0], invalidRow, lines[1]].join("\n");

  const report = diagnoseCsv({
    csvText: mixedCsv,
    filename: "mixed.csv",
    metadata,
    pricePolicy: policy,
    clock: fixedClock("2026-06-30T12:00:00Z"),
    runId: "fixed-run"
  });

  assert.equal(report.run.status, "PARTIAL");
  assert.equal(report.summary.processed, 2);
  assert.equal(report.summary.rowErrors, 1);
  assert.equal(report.items[0].verdict, "BLOCKED");
  assert.ok(report.items[0].issues.some((issue) => issue.ruleId === "COST_OUT_OF_RANGE"));
  assert.equal(report.items[1].price?.sellPrice, 19900);
});

test("inputSha256은 실제 SHA-256이다", () => {
  const report = diagnoseCsv({
    csvText: normalCsv,
    filename: "normal.csv",
    metadata,
    pricePolicy: policy,
    clock: fixedClock("2026-06-30T12:00:00Z"),
    runId: "fixed-run"
  });
  const expected = createHash("sha256").update(normalCsv).digest("hex");
  assert.equal(report.run.inputSha256, expected);
});

test("internalCode는 SHA-256 앞 12자리로 결정된다", () => {
  assert.equal(createInternalCode("SUPPLIER-A", "SUP-APPLE-5KG"), "P-773F6633AAC7");
});
