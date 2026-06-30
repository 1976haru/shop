export interface CsvDocument {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function decodeCsv(bytes: Uint8Array): { text: string; encoding: string } {
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  try { return { text: utf8.decode(bytes), encoding: "utf-8" }; }
  catch { return { text: new TextDecoder("euc-kr", { fatal: false }).decode(bytes), encoding: "cp949/euc-kr" }; }
}

export function parseCsv(text: string): CsvDocument {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quoted) {
      if (character === '"' && normalized[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); records.push(row); row = []; field = ""; }
    else if (character !== "\r") field += character;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  if (field.length > 0 || row.length > 0) { row.push(field); records.push(row); }
  while (records.length && records.at(-1)?.every((value) => !value.trim())) records.pop();
  if (!records.length) throw new Error("CSV가 비어 있습니다.");
  const headers = records[0].map((value) => value.trim());
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`중복된 헤더가 있습니다: ${[...new Set(duplicates)].join(", ")}`);
  const rows = records.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index]?.trim() ?? ""])
  ));
  return { headers, rows };
}

const aliases: Record<string, string[]> = {
  supplier_id: ["supplier_id", "공급사", "공급사코드"], supplier_sku: ["supplier_sku", "상품코드", "판매자상품코드", "sku"],
  product_title: ["product_title", "상품명", "제품명"], brand_mode: ["brand_mode", "브랜드구분"], brand: ["brand", "브랜드"],
  manufacturer: ["manufacturer", "제조사", "생산자"], origin_country: ["origin_country", "원산지코드"], origin_display: ["origin_display", "원산지"],
  category_hint: ["category_hint", "카테고리", "내부카테고리"], option_name: ["option_name", "옵션명"], option_value: ["option_value", "옵션값"],
  cost: ["cost", "원가"], supplier_ship_fee: ["supplier_ship_fee", "공급배송비"], fixed_cost: ["fixed_cost", "고정비", "포장비"],
  stock: ["stock", "재고", "재고수량"], tax_type: ["tax_type", "과세유형"], image_main_url: ["image_main_url", "대표이미지", "대표이미지url"],
  image_rights_confirmed: ["image_rights_confirmed", "이미지권리확인"], compliance_pack: ["compliance_pack", "규칙팩"],
  description_html: ["description_html", "상세설명"], notice_product_name: ["notice_product_name", "고시품목명"], notice_origin: ["notice_origin", "고시원산지"],
  notice_weight: ["notice_weight", "고시중량"], notice_producer: ["notice_producer", "고시생산자"], delivery_policy_code: ["delivery_policy_code", "배송정책"],
  return_policy_code: ["return_policy_code", "반품정책"]
};

export function normalizeHeaders(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  const lowerMap = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const [target, names] of Object.entries(aliases)) {
    const found = names.find((name) => lowerMap.has(name.toLowerCase()));
    result[target] = found ? lowerMap.get(found.toLowerCase()) ?? "" : "";
  }
  for (const [key, value] of Object.entries(row)) if (!(key in result)) result[key] = value;
  return result;
}

export function escapeCsvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\n\r]/.test(text)) text = '"' + text.replaceAll('"', '""') + '"';
  return text;
}
