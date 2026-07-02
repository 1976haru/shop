import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildRenderPlan } from "../../../packages/campaign/src/index.ts";
import { renderPlanToMp4 } from "../src/ffmpeg.ts";

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("fc-match", ["-f", "%{file}", ":lang=ko"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("통합: 데모 캠페인 → mp4 (720x1280, 15s, 자막 번인)", { skip: !hasFfmpeg() && "ffmpeg 또는 한글 폰트 없음" }, () => {
  const demo = JSON.parse(
    readFileSync(new URL("../../../fixtures/render/demo-campaign.json", import.meta.url), "utf8")
  );
  const plan = buildRenderPlan(demo, demo.creatives[2].id);
  const out = join(mkdtempSync(join(tmpdir(), "render-test-")), "demo.mp4");
  const result = renderPlanToMp4({
    plan,
    imagePath: new URL("../../../fixtures/render/product.png", import.meta.url).pathname,
    outputPath: out
  });
  assert.equal(result.width, 720);
  assert.equal(result.height, 1280);
  assert.ok(Math.abs(result.durationSeconds - 15) < 0.8, `길이 이탈: ${result.durationSeconds}s`);
});
