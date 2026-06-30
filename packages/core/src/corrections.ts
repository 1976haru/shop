import type { DiagnosisReport } from "./types.ts";

export function patchSourceRow(report: DiagnosisReport, itemIndex: number, field: string, value: string): string {
  const item = report.items[itemIndex];
  if (!item) throw new Error("수정할 상품을 찾을 수 없습니다.");
  const allowed = new Set(["product_title","brand_mode","brand","manufacturer","origin_country","origin_display",
    "option_name","option_value","cost","supplier_ship_fee","fixed_cost","stock","tax_type",
    "identifier_exemption_reason","notice_product_name","notice_origin","notice_weight","notice_producer"]);
  if (!allowed.has(field)) throw new Error("이 필드는 화면에서 수정할 수 없습니다.");
  item.source[field] = value;
  const headers = Object.keys(item.source);
  const rows = report.items.map((entry) => headers.map((header) => {
    const text = entry.source[header] ?? "";
    return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}
