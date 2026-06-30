import { escapeCsvCell } from "./csv.ts";
import { escapeHtml } from "./html.ts";
import type { DiagnosisReport, Severity } from "./types.ts";

export function summarizeRootCauses(
  report: Pick<DiagnosisReport, "items">
): DiagnosisReport["rootCauses"] {
  const map = new Map<
    string,
    { ruleId: string; severity: Severity; count: number; autoFixable: number }
  >();

  for (const item of report.items) {
    for (const issue of item.issues) {
      const current = map.get(issue.ruleId) ?? {
        ruleId: issue.ruleId,
        severity: issue.severity,
        count: 0,
        autoFixable: 0
      };
      current.count += 1;
      if (issue.autoFixable) current.autoFixable += 1;
      map.set(issue.ruleId, current);
    }
  }

  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId)
  );
}

export function issuesCsv(report: DiagnosisReport): string {
  const rows = [[
    "sourceRow",
    "supplierSku",
    "verdict",
    "ruleId",
    "severity",
    "field",
    "message",
    "fix"
  ]];

  for (const item of report.items) {
    for (const issue of item.issues) {
      rows.push([
        String(item.sourceRow),
        item.supplierSku,
        item.verdict,
        issue.ruleId,
        issue.severity,
        issue.field ?? "",
        issue.message,
        issue.fix ?? ""
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function renderStandaloneHtml(report: DiagnosisReport): string {
  const rows = report.items
    .map(
      (item) =>
        `<tr><td>${item.sourceRow}</td><td>${escapeHtml(item.supplierSku)}</td>` +
        `<td><span class="v ${item.verdict}">${item.verdict}</span></td>` +
        `<td>${item.readiness.overallScore}</td>` +
        `<td>${item.price?.sellPrice?.toLocaleString("ko-KR") ?? "-"}</td>` +
        `<td>${item.issues
          .map(
            (issue) =>
              `<div><b>${escapeHtml(issue.ruleId)}</b> ${escapeHtml(issue.message)}</div>`
          )
          .join("")}</td></tr>`
    )
    .join("");

  const partialMessage =
    report.run.status === "PARTIAL"
      ? `<div class="partial">일부 행은 표준 상품으로 변환되지 않았습니다. 행 오류 ${report.summary.rowErrors}건을 확인하세요.</div>`
      : "";

  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>상품 진단 리포트</title><style>body{font-family:system-ui;margin:32px;color:#172033}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d8deea;padding:8px;text-align:left;vertical-align:top}.v{font-weight:700}.BLOCKED{color:#b42318}.WARNING{color:#b54708}.PASS{color:#067647}.banner{padding:16px;background:#fff1f0;border:1px solid #fda29b;margin:16px 0}.partial{padding:16px;background:#fffaeb;border:1px solid #fedf89;margin:16px 0}.cards{display:flex;gap:12px;flex-wrap:wrap}.card{padding:12px;border:1px solid #d8deea;border-radius:10px}</style><h1>상품 진단 리포트</h1><div class="banner">외부 전송 없음 · 요청 본문 사전보기이며 실제 쿠팡 노출 결과가 아닙니다.</div>${partialMessage}<div class="cards"><div class="card">상태 ${report.run.status}</div><div class="card">처리 ${report.summary.processed}</div><div class="card">PASS ${report.summary.pass}</div><div class="card">WARNING ${report.summary.warning}</div><div class="card">BLOCKED ${report.summary.blocked}</div><div class="card">행 오류 ${report.summary.rowErrors}</div></div><p>메타데이터: ${escapeHtml(report.run.metadataVersion)} (${escapeHtml(report.run.metadataTrust)})</p><table><thead><tr><th>행</th><th>SKU</th><th>판정</th><th>준비도</th><th>판매가</th><th>문제</th></tr></thead><tbody>${rows}</tbody></table></html>`;
}
