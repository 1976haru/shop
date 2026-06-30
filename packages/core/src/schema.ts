import { normalizeAttributeValue } from "./attributes.ts";
import { canonicalProductSchema } from "./domain-schema.ts";
import { createInternalCode } from "./ids.ts";
import type {
  CanonicalProduct,
  DiagnosticIssue,
  IdentifierExemptionReason,
  MetadataSnapshot,
  PricePolicy,
  ProductIdentifier
} from "./types.ts";

interface IntegerOptions {
  required?: boolean;
  min?: number;
  max?: number;
  rangeRuleId?: string;
  label?: string;
}

function intValue(
  raw: string,
  field: string,
  issues: DiagnosticIssue[],
  options: IntegerOptions = {}
): number | undefined {
  const required = options.required ?? true;
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  const label = options.label ?? field;
  const value = raw.trim().replaceAll(",", "");

  if (!value && !required) return undefined;
  if (!value) {
    issues.push({
      ruleId: "REQUIRED_FIELD_MISSING",
      severity: "BLOCKED",
      scope: "ROW",
      field,
      message: `${label} 값이 비어 있습니다.`,
      fix: `${min.toLocaleString("ko-KR")} 이상의 정수로 입력하세요.`
    });
    return undefined;
  }
  if (!/^-?\d+(?:\.0+)?$/.test(value)) {
    issues.push({
      ruleId: "INTEGER_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field,
      message: `${label} 값이 정수가 아닙니다.`,
      fix: `${min.toLocaleString("ko-KR")} 이상의 정수로 입력하세요.`,
      evidence: { value: raw }
    });
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    issues.push({
      ruleId: "INTEGER_UNSAFE",
      severity: "BLOCKED",
      scope: "ROW",
      field,
      message: `${label} 값이 안전한 정수 범위를 벗어났습니다.`,
      evidence: { value: raw }
    });
    return undefined;
  }
  if (parsed < min || parsed > max) {
    issues.push({
      ruleId: options.rangeRuleId ?? "INTEGER_OUT_OF_RANGE",
      severity: "BLOCKED",
      scope: "ROW",
      field,
      message: `${label} 값은 ${min.toLocaleString("ko-KR")}~${max.toLocaleString("ko-KR")} 범위여야 합니다.`,
      fix: "원본 공급사 데이터를 확인해 허용 범위의 정수로 수정하세요.",
      evidence: { value: parsed, min, max }
    });
    return undefined;
  }
  return parsed;
}

function boolValue(raw: string): boolean | undefined {
  const value = raw.trim().toLowerCase();
  if (["true", "1", "y", "yes", "예", "확인"].includes(value)) return true;
  if (["false", "0", "n", "no", "아니오", "미확인"].includes(value)) return false;
  return undefined;
}

function required(row: Record<string, string>, key: string, issues: DiagnosticIssue[]): string {
  const value = row[key]?.trim() ?? "";
  if (!value) {
    issues.push({
      ruleId: "REQUIRED_FIELD_MISSING",
      severity: "BLOCKED",
      scope: "ROW",
      field: key,
      message: `${key} 필드가 비어 있습니다.`,
      fix: "공급사 파일 또는 매핑에서 값을 입력하세요."
    });
  }
  return value;
}

function identifiers(row: Record<string, string>): ProductIdentifier[] {
  return (["gtin", "mpn", "model_no"] as const).flatMap((field) => {
    const value = row[field]?.trim();
    if (!value) return [];
    return [{
      type: field === "gtin" ? "GTIN" : field === "mpn" ? "MPN" : "MODEL_NO",
      value,
      source: "SUPPLIER" as const
    }];
  });
}

export function rowToCanonical(
  row: Record<string, string>,
  defaults: PricePolicy,
  metadata: MetadataSnapshot
): { product?: CanonicalProduct; issues: DiagnosticIssue[] } {
  const issues: DiagnosticIssue[] = [];
  const supplierId = required(row, "supplier_id", issues);
  const supplierSku = required(row, "supplier_sku", issues);
  const titleRaw = required(row, "product_title", issues);
  const brandMode = required(row, "brand_mode", issues);
  const manufacturer = required(row, "manufacturer", issues);
  const originCountry = required(row, "origin_country", issues).toUpperCase();
  const originDisplay = required(row, "origin_display", issues);
  const categoryCode = required(row, "category_hint", issues);
  const imageUrl = required(row, "image_main_url", issues);
  const optionName = required(row, "option_name", issues);
  const optionValue = required(row, "option_value", issues);
  const deliveryPolicyCode = required(row, "delivery_policy_code", issues);
  const returnPolicyCode = required(row, "return_policy_code", issues);

  const cost = intValue(row.cost ?? "", "cost", issues, {
    min: 0,
    max: 1_000_000_000,
    rangeRuleId: "COST_OUT_OF_RANGE",
    label: "원가"
  });
  const ship = intValue(row.supplier_ship_fee ?? "0", "supplier_ship_fee", issues, {
    min: 0,
    max: 1_000_000_000,
    rangeRuleId: "SUPPLIER_SHIP_FEE_OUT_OF_RANGE",
    label: "공급처 배송비"
  });
  const fixed = intValue(row.fixed_cost ?? "0", "fixed_cost", issues, {
    min: 0,
    max: 1_000_000_000,
    rangeRuleId: "FIXED_COST_OUT_OF_RANGE",
    label: "고정비"
  });
  const stock = intValue(row.stock ?? "", "stock", issues, {
    min: 0,
    max: 99_999,
    rangeRuleId: "STOCK_OUT_OF_RANGE",
    label: "재고수량"
  });
  const weight = intValue(row.weight_g ?? "", "weight_g", issues, {
    required: false,
    min: 1,
    max: 1_000_000_000,
    rangeRuleId: "WEIGHT_OUT_OF_RANGE",
    label: "중량(g)"
  });

  const rights = boolValue(row.image_rights_confirmed ?? "");
  if (rights === undefined) {
    issues.push({
      ruleId: "BOOLEAN_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field: "image_rights_confirmed",
      message: "이미지 권리 확인값은 true 또는 false여야 합니다."
    });
  }

  if (!["BRANDED", "UNBRANDED", "UNKNOWN"].includes(brandMode)) {
    issues.push({
      ruleId: "BRAND_MODE_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field: "brand_mode",
      message: "brand_mode는 BRANDED, UNBRANDED, UNKNOWN 중 하나여야 합니다."
    });
  }
  const pack = required(row, "compliance_pack", issues);
  if (!["AGRI_KR", "HEALTH_SUPPLEMENT_KR", "GENERAL_GOODS_KR", "OVERSEAS_KR"].includes(pack)) {
    issues.push({
      ruleId: "COMPLIANCE_PACK_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field: "compliance_pack",
      message: "지원하지 않는 규칙팩입니다."
    });
  }
  const taxType = required(row, "tax_type", issues);
  if (!["TAX", "FREE"].includes(taxType)) {
    issues.push({
      ruleId: "TAX_TYPE_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field: "tax_type",
      message: "tax_type은 TAX 또는 FREE여야 합니다."
    });
  }
  if (!/^[A-Z]{2}$/.test(originCountry)) {
    issues.push({
      ruleId: "ORIGIN_COUNTRY_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field: "origin_country",
      message: "원산지 코드는 ISO-3166 alpha-2 두 글자 형식이어야 합니다.",
      fix: "대한민국은 KR처럼 두 글자 국가코드로 입력하세요.",
      evidence: { value: originCountry }
    });
  }

  const exemptionRaw = row.identifier_exemption_reason?.trim();
  const validExemptions = ["UNBRANDED", "HANDMADE", "CUSTOM_MADE", "NO_OFFICIAL_IDENTIFIER", "NOT_APPLICABLE"];
  if (exemptionRaw && !validExemptions.includes(exemptionRaw)) {
    issues.push({
      ruleId: "IDENTIFIER_EXEMPTION_INVALID",
      severity: "BLOCKED",
      scope: "ROW",
      field: "identifier_exemption_reason",
      message: "식별자 면제 사유가 올바르지 않습니다."
    });
  }

  if (issues.some((issue) => issue.severity === "BLOCKED" && issue.scope === "ROW")) {
    return { issues };
  }

  const meta = metadata.categories.find((category) => category.internalCategoryCode === categoryCode);
  const titleStandard = titleRaw.trim().replace(/\s+/g, " ");
  const candidate = {
    schemaVersion: "1.1.0" as const,
    internalCode: createInternalCode(supplierId, supplierSku),
    supplierId,
    supplierSku,
    titleRaw,
    titleStandard,
    brand: {
      mode: brandMode,
      ...(row.brand?.trim() ? { name: row.brand.trim() } : {})
    },
    manufacturer,
    originCountry,
    originDisplay,
    internalCategoryCode: categoryCode,
    ...(row.description_html?.trim() ? { descriptionHtml: row.description_html.trim() } : {}),
    images: [{
      type: "REPRESENTATION" as const,
      sourceUrl: imageUrl,
      order: 0,
      rightsConfirmed: rights ?? false,
      inspectionStatus: "NOT_INSPECTED" as const
    }],
    skus: [{
      skuCode: supplierSku,
      options: [{
        name: optionName,
        value: optionValue,
        normalized: normalizeAttributeValue(optionValue)
      }],
      identifiers: identifiers(row),
      ...(exemptionRaw ? { identifierExemptionReason: exemptionRaw as IdentifierExemptionReason } : {}),
      pricePolicy: {
        ...defaults,
        cost: cost ?? 0,
        supplierShipFee: ship ?? 0,
        fixedCost: fixed ?? 0
      },
      stock: stock ?? 0,
      ...(weight !== undefined ? { weightGrams: weight } : {}),
      taxType
    }],
    disclosure: {
      noticeCategoryName: meta?.noticeCategoryName ?? "미매핑",
      fields: {
        "품목 또는 명칭": row.notice_product_name?.trim() ?? "",
        "원산지": row.notice_origin?.trim() ?? "",
        "중량": row.notice_weight?.trim() ?? "",
        "생산자": row.notice_producer?.trim() ?? ""
      }
    },
    compliancePack: pack,
    deliveryPolicyCode,
    returnPolicyCode,
    status: "DRAFT" as const
  };

  const parsed = canonicalProductSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        ruleId: "CANONICAL_SCHEMA_INVALID",
        severity: "BLOCKED",
        scope: "ROW",
        field: issue.path.join("."),
        message: `표준 상품 변환 결과가 스키마에 맞지 않습니다: ${issue.message}`,
        evidence: { code: issue.code }
      });
    }
    return { issues };
  }

  return { product: parsed.data, issues };
}
