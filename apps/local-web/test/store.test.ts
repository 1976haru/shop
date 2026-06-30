import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunStore } from "../src/store.ts";
import type { DiagnosisReport } from "../../../packages/core/src/types.ts";

test("진단 이력을 저장하고 불러온다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shop-store-"));
  const store = new RunStore(join(directory, "runs.sqlite"));
  const report = { reportVersion: "1.1.0", generatedAt: "2026-06-30T12:00:00Z",
    run: { id: "run-test", inputFilename: "x.csv", inputSha256: "0".repeat(64), rowCount: 0,
      metadataTrust: "FIXTURE", metadataVersion: "fixture", publishReady: false },
    summary: { processed: 0, pass: 0, warning: 0, blocked: 0, rowErrors: 0 }, rootCauses: [], items: [] } as DiagnosisReport;
  store.save(report, "a,b");
  assert.equal(store.get("run-test")?.report.run.id, "run-test");
  assert.equal(store.list().length, 1);
  assert.equal(store.delete("run-test"), true);
  await rm(directory, { recursive: true, force: true });
});
