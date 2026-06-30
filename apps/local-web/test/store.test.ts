import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { DiagnosisReport } from "../../../packages/core/src/types.ts";
import { RunStore } from "../src/store.ts";

const pricePolicy = {
  cost: 0,
  supplierShipFee: 0,
  fixedCost: 0,
  platformFeeBp: 1080,
  adReserveBp: 500,
  returnReserveBp: 200,
  paymentReserveBp: 0,
  targetContributionMarginBp: 2000,
  roundingMode: "END_900" as const
};

test("진단 이력을 저장하고 불러온다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shop-store-"));
  const store = new RunStore(join(directory, "runs.sqlite"));
  const report: DiagnosisReport = {
    reportVersion: "1.2.0",
    generatedAt: "2026-06-30T12:00:00Z",
    run: {
      id: "run-test",
      status: "COMPLETED",
      inputFilename: "x.csv",
      inputSha256: "0".repeat(64),
      rowCount: 0,
      metadataTrust: "FIXTURE",
      metadataVersion: "fixture",
      pricePolicy,
      publishReady: false
    },
    summary: {
      processed: 0,
      pass: 0,
      warning: 0,
      blocked: 0,
      rowErrors: 0
    },
    rootCauses: [],
    items: []
  };

  store.save(report, "a,b");
  assert.equal(store.get("run-test")?.report.run.id, "run-test");
  assert.deepEqual(store.get("run-test")?.report.run.pricePolicy, pricePolicy);
  assert.equal(store.list().length, 1);
  assert.equal(store.delete("run-test"), true);
  await rm(directory, { recursive: true, force: true });
});
