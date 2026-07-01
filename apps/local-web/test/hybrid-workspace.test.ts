import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRoot = new URL("../public/", import.meta.url);
const sourceRoot = new URL("../src/", import.meta.url);

test("hybrid workspace connects diagnosis, shorts, and performance", async () => {
  const html = await readFile(new URL("index.html", publicRoot), "utf8");

  assert.match(html, /id="shorts-studio"/);
  assert.match(html, /id="campaignRun"/);
  assert.match(html, /id="campaignCreativeTabs"/);
  assert.match(html, /id="renderShortVideo"/);
  assert.match(html, /id="savePerformance"/);
  assert.match(html, /src="\/hybrid\.js"/);
});

test("browser renderer creates a vertical video with a safe fallback", async () => {
  const script = await readFile(new URL("hybrid.js", publicRoot), "utf8");

  assert.match(script, /MediaRecorder/);
  assert.match(script, /captureStream\(30\)/);
  assert.match(script, /video\/mp4/);
  assert.match(script, /video\/webm/);
  assert.match(script, /downloadSrt/);
});

test("campaign API supports create, approval, performance, and persistence", async () => {
  const api = await readFile(new URL("api-campaigns.ts", sourceRoot), "utf8");
  const store = await readFile(new URL("store.ts", sourceRoot), "utf8");

  assert.match(api, /\/api\/campaigns\/from-run/);
  assert.match(api, /segments\[3\] === "approve"/);
  assert.match(api, /segments\[3\] === "performance"/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS campaigns/);
  assert.match(store, /saveCampaign/);
});
