import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, escapeCsvCell } from "../src/csv.ts";

test("인용된 CSV 셀을 파싱", () => {
  const document = parseCsv('a,b\n"x,y","z"');
  assert.equal(document.rows[0].a, "x,y");
});

test("CSV 수식 주입을 방지", () => {
  assert.equal(escapeCsvCell("=1+1"), "'=1+1");
});
