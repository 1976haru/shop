import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRoot = new URL("../public/", import.meta.url);

async function publicFile(name: string): Promise<string> {
  return readFile(new URL(name, publicRoot), "utf8");
}

test("phase 1 workbench exposes price policy and readiness dashboard", async () => {
  const html = await publicFile("index.html");

  assert.match(html, /id="platformFeePercent"/);
  assert.match(html, /id="targetMarginPercent"/);
  assert.match(html, /id="roundingMode"/);
  assert.match(html, /id="readinessDashboard"/);
  assert.match(html, /id="editDialog"/);
});

test("inline correction no longer relies on browser prompt", async () => {
  const app = await publicFile("app.js");

  assert.doesNotMatch(app, /\bprompt\s*\(/);
  assert.match(app, /\/api\/runs\/\$\{current\.run\.id\}\/patch/);
  assert.match(app, /pricePolicy:\s*buildPricePolicy\(\)/);
  assert.match(app, /localStorage\.setItem/);
});

test("workbench stylesheet includes responsive and print modes", async () => {
  const css = await publicFile("styles.css");

  assert.match(css, /\.readiness-dashboard/);
  assert.match(css, /\.edit-dialog/);
  assert.match(css, /@media \(max-width: 580px\)/);
  assert.match(css, /@media print/);
});
