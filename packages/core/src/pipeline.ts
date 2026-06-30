import { createRunId } from "./ids.ts";
import { parseCsv, normalizeHeaders } from "./csv.ts";
import { rowToCanonical } from "./schema.ts";
import { diagnoseProduct, verdictFor } from "./diagnostics.ts";
import { buildCoupangPreview } from "./payload.ts";
import { sanitizeHtml } from "./html.ts";
import { summarizeRootCauses } from "./report.ts";
import type { Clock, DiagnosisItem, DiagnosisReport, MetadataSnapshot, PricePolicy } from "./types.ts";

function inputSignature(value: string): string {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 33 + value.charCodeAt(index)) >>> 0;
  return total.toString(16).padStart(8, "0").repeat(8);
}

export function diagnoseCsv(input: {
  csvText: string; filename: string; metadata: MetadataSnapshot; pricePolicy: PricePolicy;
  clock: Clock; runId?: string; maxRows?: number;
}): DiagnosisReport {
  const document = parseCsv(input.csvText);
  const maxRows = input.maxRows ?? 5000;
  if (document.rows.length > maxRows) throw new Error(`행 수가 최대 ${maxRows.toLocaleString("ko-KR")}개를 초과했습니다.`);
  const items: DiagnosisItem[] = document.rows.map((original, index) => {
    const sourceRow = index + 2;
    const row = normalizeHeaders(original);
    const base = rowToCanonical(row, input.pricePolicy, input.metadata);
    if (!base.product) return { sourceRow, supplierId: row.supplier_id ?? "", supplierSku: row.supplier_sku ?? "",
      verdict: verdictFor(base.issues), issues: base.issues,
      readiness: { dataQualityScore: 0, channelCompatibilityScore: 0, complianceSafetyScore: 0,
        marginHealthScore: 0, overallScore: 0, scoreVersion: "1.0.0" }, source: original };
    if (base.product.descriptionHtml) {
      const sanitized = sanitizeHtml(base.product.descriptionHtml);
      base.product.descriptionHtml = sanitized.html;
      if (sanitized.changed) base.issues.push({ ruleId: "HTML_UNSAFE_CONTENT_REMOVED", severity: "WARNING", scope: "PRODUCT",
        field: "descriptionHtml", message: "상세설명에서 안전하지 않은 HTML을 제거했습니다.", autoFixable: true });
    }
    const diagnosis = diagnoseProduct(base.product, input.metadata);
    const issues = [...base.issues, ...diagnosis.issues];
    const verdict = verdictFor(issues);
    const preview = buildCoupangPreview(base.product, input.metadata, diagnosis.price, issues, input.clock.now());
    return { sourceRow, supplierId: base.product.supplierId, supplierSku: base.product.supplierSku,
      internalCode: base.product.internalCode, verdict, issues, canonical: base.product,
      price: diagnosis.price, readiness: diagnosis.readiness, coupangPayloadPreview: preview, source: original };
  });
  const report: DiagnosisReport = {
    reportVersion: "1.1.0", generatedAt: input.clock.now().toISOString(),
    run: { id: input.runId ?? createRunId(), inputFilename: input.filename, inputSha256: inputSignature(input.csvText),
      rowCount: document.rows.length, metadataTrust: input.metadata.sourceType, metadataVersion: input.metadata.version,
      publishReady: input.metadata.sourceType !== "FIXTURE" && items.every((item) => item.verdict !== "BLOCKED") },
    summary: { processed: items.length, pass: items.filter((item) => item.verdict === "PASS").length,
      warning: items.filter((item) => item.verdict === "WARNING").length,
      blocked: items.filter((item) => item.verdict === "BLOCKED").length,
      rowErrors: items.filter((item) => !item.canonical).length }, rootCauses: [], items
  };
  report.rootCauses = summarizeRootCauses(report);
  return report;
}
