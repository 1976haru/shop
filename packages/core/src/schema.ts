import { createInternalCode } from "./ids.ts";
import { normalizeAttributeValue } from "./attributes.ts";
import type { CanonicalProduct, CompliancePack, DiagnosticIssue, IdentifierExemptionReason, MetadataSnapshot, PricePolicy, ProductIdentifier, TaxType } from "./types.ts";

const packs = new Set(["AGRI_KR", "HEALTH_SUPPLEMENT_KR", "GENERAL_GOODS_KR", "OVERSEAS_KR"]);
const exemptions = new Set(["UNBRANDED", "HANDMADE", "CUSTOM_MADE", "NO_OFFICIAL_IDENTIFIER", "NOT_APPLICABLE"]);

function intValue(raw: string, field: string, issues: DiagnosticIssue[], requiredValue = true): number | undefined {
  const value = raw.trim().replaceAll(",", "");
  if (!value && !requiredValue) return undefined;
  if (!/^-?\d+(?:\.0+)?$/.test(value)) {
    issues.push({ ruleId: "INTEGER_INVALID", severity: "BLOCKED", scope: "ROW", field,
      message: `${field} 값이 정수가 아닙니다.`, fix: "0 이상의 정수로 입력하세요.", evidence: { value: raw } });
    return undefined;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    issues.push({ ruleId: "INTEGER_UNSAFE", severity: "BLOCKED", scope: "ROW", field,
      message: `${field} 값이 안전한 정수 범위를 벗어났습니다.` });
    return undefined;
  }
  return number;
}

function boolValue(raw: string): boolean | undefined {
  const value = raw.trim().toLowerCase();
  if (["true", "1", "y", "yes", "예", "확인"].includes(value)) return true;
  if (["false", "0", "n", "no", "아니오", "미확인"].includes(value)) return false;
  return undefined;
}

function required(row: Record<string, string>, key: string, issues: DiagnosticIssue[]): string {
  const value = row[key]?.trim() ?? "";
  if (!value) issues.push({ ruleId: "REQUIRED_FIELD_MISSING", severity: "BLOCKED", scope: "ROW", field: key,
    message: `${key} 필드가 비어 있습니다.`, fix: "공급사 파일 또는 매핑에서 값을 입력하세요." });
  return value;
}

function identifiers(row: Record<string, string>): ProductIdentifier[] {
  return (["gtin", "mpn", "model_no"] as const).flatMap((field) => {
    const value = row[field]?.trim();
    if (!value) return [];
    return [{ type: field === "gtin" ? "GTIN" : field === "mpn" ? "MPN" : "MODEL_NO",
      value, source: "SUPPLIER" as const }];
  });
}

export function rowToCanonical(row: Record<string, string>, defaults: PricePolicy, metadata: MetadataSnapshot): { product?: CanonicalProduct; issues: DiagnosticIssue[] } {
  const issues: DiagnosticIssue[] = [];
  const supplierId = required(row, "supplier_id", issues);
  const supplierSku = required(row, "supplier_sku", issues);
  const titleRaw = required(row, "product_title", issues);
  const brandMode = required(row, "brand_mode", issues) as CanonicalProduct["brand"]["mode"];
  if (!["BRANDED", "UNBRANDED", "UNKNOWN"].includes(brandMode)) {
    issues.push({ ruleId: "BRAND_MODE_INVALID", severity: "BLOCKED", scope: "PRODUCT", field: "brand_mode",
      message: "brand_mode는 BRANDED, UNBRANDED, UNKNOWN 중 하나여야 합니다." });
  }
  const cost = intValue(row.cost ?? "", "cost", issues);
  const ship = intValue(row.supplier_ship_fee ?? "0", "supplier_ship_fee", issues);
  const fixed = intValue(row.fixed_cost ?? "0", "fixed_cost", issues);
  const stock = intValue(row.stock ?? "", "stock", issues);
  const weight = intValue(row.weight_g ?? "", "weight_g", issues, false);
  const rights = boolValue(row.image_rights_confirmed ?? "");
  if (rights === undefined) issues.push({ ruleId: "BOOLEAN_INVALID", severity: "BLOCKED", scope: "ROW",
    field: "image_rights_confirmed", message: "이미지 권리 확인값은 true 또는 false여야 합니다." });
  const pack = required(row, "compliance_pack", issues) as CompliancePack;
  if (!packs.has(pack)) issues.push({ ruleId: "COMPLIANCE_PACK_INVALID", severity: "BLOCKED", scope: "PRODUCT",
    field: "compliance_pack", message: "지원하지 않는 규칙팩입니다." });
  const taxType = required(row, "tax_type", issues) as TaxType;
  if (!["TAX", "FREE"].includes(taxType)) issues.push({ ruleId: "TAX_TYPE_INVALID", severity: "BLOCKED", scope: "SKU",
    field: "tax_type", message: "tax_type은 TAX 또는 FREE여야 합니다." });
  const exemption = row.identifier_exemption_reason?.trim() as IdentifierExemptionReason | undefined;
  if (exemption && !exemptions.has(exemption)) issues.push({ ruleId: "IDENTIFIER_EXEMPTION_INVALID", severity: "BLOCKED",
    scope: "SKU", field: "identifier_exemption_reason", message: "식별자 면제 사유가 올바르지 않습니다." });
  if (issues.some((issue) => issue.severity === "BLOCKED" && issue.scope === "ROW")) return { issues };

  const categoryCode = required(row, "category_hint", issues);
  const meta = metadata.categories.find((category) => category.internalCategoryCode === categoryCode);
  const imageUrl = required(row, "image_main_url", issues);
  const titleStandard = titleRaw.trim().replace(/\s+/g, " ");
  const product: CanonicalProduct = {
    schemaVersion: "1.1.0", internalCode: createInternalCode(supplierId, supplierSku), supplierId, supplierSku,
    titleRaw, titleStandard, brand: { mode: brandMode, name: row.brand?.trim() || undefined },
    manufacturer: required(row, "manufacturer", issues), originCountry: required(row, "origin_country", issues).toUpperCase(),
    originDisplay: required(row, "origin_display", issues), internalCategoryCode: categoryCode,
    descriptionHtml: row.description_html?.trim() || undefined,
    images: [{ type: "REPRESENTATION", sourceUrl: imageUrl, order: 0, rightsConfirmed: rights ?? false, inspectionStatus: "NOT_INSPECTED" }],
    skus: [{ skuCode: supplierSku, options: [{ name: required(row, "option_name", issues), value: required(row, "option_value", issues),
      normalized: normalizeAttributeValue(row.option_value ?? "") }], identifiers: identifiers(row), identifierExemptionReason: exemption,
      pricePolicy: { ...defaults, cost: cost ?? 0, supplierShipFee: ship ?? 0, fixedCost: fixed ?? 0 }, stock: stock ?? 0,
      weightGrams: weight, taxType }],
    disclosure: { noticeCategoryName: meta?.noticeCategoryName ?? "미매핑", fields: {
      "품목 또는 명칭": row.notice_product_name?.trim() ?? "", "원산지": row.notice_origin?.trim() ?? "",
      "중량": row.notice_weight?.trim() ?? "", "생산자": row.notice_producer?.trim() ?? "" } },
    compliancePack: pack, deliveryPolicyCode: required(row, "delivery_policy_code", issues),
    returnPolicyCode: required(row, "return_policy_code", issues), status: "DRAFT"
  };
  return { product, issues };
}
