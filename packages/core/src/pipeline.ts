import { normalizeHeaders, parseCsv } from "./csv.ts";
import { diagnoseProduct, readinessScores, verdictFor } from "./diagnostics.ts";
import { diagnosisReportSchema } from "./domain-schema.ts";
import { sanitizeHtml } from "./html.ts";
import { createRunId, sha256 } from "./ids.ts";
import { buildCoupangPreview } from "./payload.ts";
import { summarizeRootCauses } from "./report.ts";
import { rowToCanonical } from "./schema.ts";
import type {
  Clock,
  DiagnosisItem,
  DiagnosisReport,
  MetadataSnapshot,
  PricePolicy,
  ReadinessScores
} from "./types.ts";

function emptyReadiness(): ReadinessScores {
  return {
    dataQualityScore: 0,
    channelCompatibilityScore: 0,
    complianceSafetyScore: 0,
    marginHealthScore: 0,
    overallScore: 0,
    scoreVersion: "1.0.0"
  };
}

function unexpectedRowError(
  original: Record<string, string>,
  normalized: Record<string, string>,
  sourceRow: number,
  error: unknown
): DiagnosisItem {
  return {
    sourceRow,
    supplierId: normalized.supplier_id ?? "",
    supplierSku: normalized.supplier_sku ?? "",
    verdict: "BLOCKED",
    issues: [{
      ruleId: "DIAGNOSIS_ROW_ERROR",
      severity: "BLOCKED",
      scope: "ROW",
      message: "이 행을 진단하는 중 예상하지 못한 오류가 발생했습니다. 다른 행의 진단은 계속 진행했습니다.",
      fix: "해당 행의 원본 값을 확인하고, 문제가 반복되면 리포트와 함께 오류를 신고하세요.",
      evidence: {
        sourceRow,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }],
    readiness: emptyReadiness(),
    source: original
  };
}

export function diagnoseCsv(input: {
  csvText: string;
  filename: string;
  metadata: MetadataSnapshot;
  pricePolicy: PricePolicy;
  clock: Clock;
  runId?: string;
  maxRows?: number;
}): DiagnosisReport {
  const document = parseCsv(input.csvText);
  const maxRows = input.maxRows ?? 5000;
  if (document.rows.length > maxRows) {
    throw new Error(`행 수가 최대 ${maxRows.toLocaleString("ko-KR")}개를 초과했습니다.`);
  }

  const items: DiagnosisItem[] = document.rows.map((original, index) => {
    const sourceRow = index + 2;
    const row = normalizeHeaders(original);

    try {
      const base = rowToCanonical(row, input.pricePolicy, input.metadata);
      if (!base.product) {
        return {
          sourceRow,
          supplierId: row.supplier_id ?? "",
          supplierSku: row.supplier_sku ?? "",
          verdict: verdictFor(base.issues),
          issues: base.issues,
          readiness: emptyReadiness(),
          source: original
        };
      }

      if (base.product.descriptionHtml) {
        const sanitized = sanitizeHtml(base.product.descriptionHtml);
        base.product.descriptionHtml = sanitized.html;
        if (sanitized.changed) {
          base.issues.push({
            ruleId: "HTML_UNSAFE_CONTENT_REMOVED",
            severity: "WARNING",
            scope: "PRODUCT",
            field: "descriptionHtml",
            message: "상세설명에서 안전하지 않은 HTML을 제거했습니다.",
            autoFixable: true
          });
        }
      }

      const diagnosis = diagnoseProduct(base.product, input.metadata);
      const issues = [...base.issues, ...diagnosis.issues];
      const verdict = verdictFor(issues);
      const preview = buildCoupangPreview(
        base.product,
        input.metadata,
        diagnosis.price,
        issues,
        input.clock.now()
      );

      return {
        sourceRow,
        supplierId: base.product.supplierId,
        supplierSku: base.product.supplierSku,
        internalCode: base.product.internalCode,
        verdict,
        issues,
        canonical: base.product,
        price: diagnosis.price,
        readiness: readinessScores(issues, diagnosis.price),
        coupangPayloadPreview: preview,
        source: original
      };
    } catch (error: unknown) {
      return unexpectedRowError(original, row, sourceRow, error);
    }
  });

  const rowErrors = items.filter((item) => !item.canonical).length;
  const report: DiagnosisReport = {
    reportVersion: "1.2.0",
    generatedAt: input.clock.now().toISOString(),
    run: {
      id: input.runId ?? createRunId(),
      status: rowErrors > 0 ? "PARTIAL" : "COMPLETED",
      inputFilename: input.filename,
      inputSha256: sha256(input.csvText),
      rowCount: document.rows.length,
      metadataTrust: input.metadata.sourceType,
      metadataVersion: input.metadata.version,
      pricePolicy: input.pricePolicy,
      publishReady:
        input.metadata.sourceType !== "FIXTURE" &&
        rowErrors === 0 &&
        items.every((item) => item.verdict !== "BLOCKED")
    },
    summary: {
      processed: items.length,
      pass: items.filter((item) => item.verdict === "PASS").length,
      warning: items.filter((item) => item.verdict === "WARNING").length,
      blocked: items.filter((item) => item.verdict === "BLOCKED").length,
      rowErrors
    },
    rootCauses: [],
    items
  };

  report.rootCauses = summarizeRootCauses(report);
  return diagnosisReportSchema.parse(report);
}
