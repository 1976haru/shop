import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAttributeValue } from "../src/attributes.ts";

test("5000g를 5kg으로 정규화", () => {
  const result = normalizeAttributeValue("5000g");
  assert.equal(result.normalizedText, "5kg");
  assert.equal(result.parseStatus, "PARSED");
});
