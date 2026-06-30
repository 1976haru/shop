import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeHtml } from "../src/html.ts";

test("script iframe event handler와 위험 URL을 제거한다", () => {
  const dirty = '<ScRiPt>alert(1)</ScRiPt><p onclick="x()">안전</p><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">링크</a>';
  const result = sanitizeHtml(dirty);
  assert.equal(result.changed, true);
  assert.equal(result.html, "<p>안전</p>링크");
});

test("깨진 중첩 HTML도 허용 태그만 남긴다", () => {
  const result = sanitizeHtml("<p><strong>상품</p></strong><svg><script>x</script></svg>");
  assert.equal(result.changed, true);
  assert.ok(result.html.includes("상품"));
  assert.equal(result.html.includes("script"), false);
  assert.equal(result.html.includes("svg"), false);
});
