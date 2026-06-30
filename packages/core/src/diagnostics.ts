import { calculatePrice } from "./money.ts";
import type {
  CanonicalProduct,
  DiagnosticIssue,
  MetadataSnapshot,
  PriceResult,
  ReadinessScores,
  Verdict
} from "./types.ts";

function gtinValid(value: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const check = digits.pop();
  if (check === undefined) return false;
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += digits[index] * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === check;
}

export function verdictFor(issues: DiagnosticIssue[]): Verdict {
  if (issues.some((issue) => issue.severity === "BLOCKED")) return "BLOCKED";
  if (issues.some((issue) => issue.severity === "WARNING")) return "WARNING";
  return "PASS";
}

export function diagnoseProduct(product: CanonicalProduct, metadata: MetadataSnapshot): {
  issues: DiagnosticIssue[];
  price: PriceResult;
  verdict: Verdict;
  readiness: ReadinessScores;
} {
  const issues: DiagnosticIssue[] = [];
  const sku = product.skus[0];
  if (!sku) throw new Error("표준 상품에 SKU가 없습니다.");
  const category = metadata.categories.find(
    (item) => item.internalCategoryCode === product.internalCategoryCode
  );

  if (product.titleStandard.length > 100) {
    issues.push({
      ruleId: "TITLE_TOO_LONG",
      severity: "BLOCKED",
      scope: "PRODUCT",
      field: "titleStandard",
      message: "표준 상품명이 100자를 초과했습니다.",
      fix: "사실을 유지하며 100자 이하로 줄이세요.",
      autoFixable: true,
      suggestedValue: product.titleStandard.slice(0, 100)
    });
  }

  const itemName = sku.options
    .map((option) => `${option.name}:${option.normalized?.normalizedText || option.value}`)
    .join(", ");
  if (itemName.length > 150) {
    issues.push({
      ruleId: "ITEM_NAME_TOO_LONG",
      severity: "BLOCKED",
      scope: "SKU",
      field: "skus[0].options",
      message: "옵션 조합으로 만든 itemName이 150자를 초과했습니다.",
      fix: "옵션명과 옵션값을 사실을 유지하는 범위에서 간결하게 정리하세요.",
      evidence: { length: itemName.length, maxLength: 150 }
    });
  }

  if (product.brand.mode === "UNKNOWN") {
    issues.push({
      ruleId: "BRAND_MODE_UNKNOWN",
      severity: "BLOCKED",
      scope: "PRODUCT",
      field: "brand.mode",
      message: "브랜드 여부가 확인되지 않았습니다.",
      fix: "BRANDED 또는 UNBRANDED를 사람이 확인하세요."
    });
  }
  if (product.brand.mode === "BRANDED" && !product.brand.name) {
    issues.push({
      ruleId: "BRAND_NAME_MISSING",
      severity: "BLOCKED",
      scope: "PRODUCT",
      field: "brand.name",
      message: "브랜드 상품인데 브랜드명이 없습니다."
    });
  }

  for (const identifier of sku.identifiers.filter((item) => item.type === "GTIN")) {
    if (!gtinValid(identifier.value)) {
      issues.push({
        ruleId: "GTIN_INVALID",
        severity: "BLOCKED",
        scope: "SKU",
        field: "skus[0].identifiers",
        message: "GTIN 자리수 또는 체크디지트가 올바르지 않습니다.",
        evidence: { value: identifier.value }
      });
    }
    if (identifier.value === sku.skuCode) {
      issues.push({
        ruleId: "IDENTIFIER_LOOKS_LIKE_INTERNAL_SKU",
        severity: "BLOCKED",
        scope: "SKU",
        field: "skus[0].identifiers",
        message: "내부 SKU를 공식 식별번호로 사용하면 안 됩니다."
      });
    }
  }

  if (!sku.identifiers.length && !sku.identifierExemptionReason) {
    issues.push({
      ruleId: "IDENTIFIER_EXEMPTION_MISSING",
      severity: "BLOCKED",
      scope: "SKU",
      field: "identifierExemptionReason",
      message: "공식 식별번호가 없다면 면제 사유가 필요합니다."
    });
  } else if (!sku.identifiers.length) {
    issues.push({
      ruleId: "IDENTIFIER_EXEMPTION_USED",
      severity: "INFO",
      scope: "SKU",
      field: "identifierExemptionReason",
      message: "식별번호 면제 사유가 사용되었습니다.",
      evidence: { reason: sku.identifierExemptionReason }
    });
  }

  if (!category || category.displayCategoryCode === null) {
    issues.push({
      ruleId: "CATEGORY_UNMAPPED",
      severity: "BLOCKED",
      scope: "METADATA",
      field: "internalCategoryCode",
      message: "내부 카테고리에 대응하는 쿠팡 카테고리가 없습니다."
    });
  }
  if (metadata.sourceType === "FIXTURE") {
    issues.push({
      ruleId: "METADATA_FIXTURE_ONLY",
      severity: "WARNING",
      scope: "METADATA",
      message: "Mock 메타데이터를 사용했으므로 실제 등록 준비 완료로 판정하지 않습니다."
    });
  }

  if (category) {
    for (const required of category.requiredAttributes.filter((attribute) => attribute.required)) {
      const option = sku.options.find((item) => item.name === required.attributeTypeName);
      if (!option) {
        issues.push({
          ruleId: "REQUIRED_ATTRIBUTE_MISSING",
          severity: "BLOCKED",
          scope: "SKU",
          field: "options",
          message: `필수 구매옵션 '${required.attributeTypeName}'이 없습니다.`
        });
      } else if (!option.value.trim()) {
        issues.push({
          ruleId: "REQUIRED_ATTRIBUTE_VALUE_MISSING",
          severity: "BLOCKED",
          scope: "SKU",
          field: "options",
          message: `필수 구매옵션 '${required.attributeTypeName}'의 값이 없습니다.`
        });
      } else if (required.allowedUnits.length) {
        const normalized = option.normalized;
        if (normalized?.parseStatus === "AMBIGUOUS" || normalized?.parseStatus === "TEXT_ONLY") {
          issues.push({
            ruleId: "REQUIRED_ATTRIBUTE_VALUE_UNPARSEABLE",
            severity: "WARNING",
            scope: "SKU",
            field: "options",
            message: `'${option.value}'의 수치와 단위를 확실히 분리하지 못했습니다.`
          });
        } else if (
          normalized?.unitCanonical &&
          !required.allowedUnits.includes(normalized.unitCanonical)
        ) {
          issues.push({
            ruleId: "REQUIRED_ATTRIBUTE_UNIT_INVALID",
            severity: "BLOCKED",
            scope: "SKU",
            field: "options",
            message: `단위 '${normalized.unitCanonical}'는 허용되지 않습니다.`,
            evidence: { allowedUnits: required.allowedUnits }
          });
        }
      }
    }

    for (const field of category.noticeRequiredFields) {
      if (!product.disclosure.fields[field]?.trim()) {
        issues.push({
          ruleId: "NOTICE_FIELD_MISSING",
          severity: "BLOCKED",
          scope: "PRODUCT",
          field: `disclosure.${field}`,
          message: `상품정보제공고시 '${field}'가 비어 있습니다.`
        });
      }
    }
  }

  const main = product.images.find((image) => image.type === "REPRESENTATION");
  if (!main) {
    issues.push({
      ruleId: "IMAGE_NO_REPRESENTATION",
      severity: "BLOCKED",
      scope: "IMAGE",
      message: "대표 이미지가 없습니다."
    });
  } else {
    if (!main.rightsConfirmed) {
      issues.push({
        ruleId: "IMAGE_RIGHTS_UNCONFIRMED",
        severity: "BLOCKED",
        scope: "IMAGE",
        field: "images[0].rightsConfirmed",
        message: "이미지 사용권이 확인되지 않았습니다."
      });
    }
    if (main.inspectionStatus === "NOT_INSPECTED") {
      issues.push({
        ruleId: "IMAGE_NOT_INSPECTED",
        severity: "WARNING",
        scope: "IMAGE",
        message: "URL만 제공되어 이미지 픽셀·용량을 실제 검사하지 못했습니다."
      });
    }
  }

  const price = calculatePrice(sku.pricePolicy);
  if (price.denominatorBp <= 0) {
    issues.push({
      ruleId: "PRICE_POLICY_IMPOSSIBLE",
      severity: "BLOCKED",
      scope: "PRICE",
      message: "수수료와 목표마진 합계가 100% 이상이라 판매가를 계산할 수 없습니다."
    });
  }
  if (price.contributionProfit < 0) {
    issues.push({
      ruleId: "PRICE_NEGATIVE_PROFIT",
      severity: "BLOCKED",
      scope: "PRICE",
      message: "예상 기여이익이 음수입니다."
    });
  } else if (price.contributionMarginBp < 500) {
    issues.push({
      ruleId: "PRICE_LOW_MARGIN",
      severity: "WARNING",
      scope: "PRICE",
      message: "예상 기여마진율이 5% 미만입니다."
    });
  }

  issues.push({
    ruleId: "PREVIEW_FINAL_DISPLAY_NOT_GUARANTEED",
    severity: "INFO",
    scope: "PAYLOAD",
    message: "요청 본문 사전보기이며 쿠팡 처리 후 최종 노출 정보는 달라질 수 있습니다."
  });

  const verdict = verdictFor(issues);
  return {
    issues,
    price,
    verdict,
    readiness: readinessScores(issues, price)
  };
}

function scoreFor(issues: DiagnosticIssue[], scopes: DiagnosticIssue["scope"][]): number {
  let score = 100;
  for (const issue of issues.filter((item) => scopes.includes(item.scope))) {
    score -= issue.severity === "BLOCKED" ? 25 : issue.severity === "WARNING" ? 8 : 0;
  }
  return Math.max(0, Math.min(100, score));
}

export function readinessScores(
  issues: DiagnosticIssue[],
  price: PriceResult
): ReadinessScores {
  const dataQualityScore = scoreFor(issues, ["FILE", "ROW", "PRODUCT", "SKU"]);
  let channelCompatibilityScore = scoreFor(issues, ["METADATA", "IMAGE", "PAYLOAD"]);
  const complianceSafetyScore = scoreFor(issues, ["PRODUCT", "IMAGE"]);
  const marginHealthScore =
    price.verdict === "BLOCKED" ? 20 : price.verdict === "WARNING" ? 65 : 100;

  if (issues.some((issue) => issue.ruleId === "METADATA_FIXTURE_ONLY")) {
    channelCompatibilityScore = Math.min(channelCompatibilityScore, 79);
  }
  if (issues.some((issue) => issue.ruleId === "IMAGE_NOT_INSPECTED")) {
    channelCompatibilityScore = Math.min(channelCompatibilityScore, 89);
  }

  let overallScore = Math.round(
    (dataQualityScore + channelCompatibilityScore + complianceSafetyScore + marginHealthScore) / 4
  );
  if (issues.some((issue) => issue.severity === "BLOCKED")) {
    overallScore = Math.min(overallScore, 69);
  }
  if (
    issues.some(
      (issue) =>
        issue.severity === "BLOCKED" &&
        (issue.scope === "PRODUCT" || issue.scope === "IMAGE")
    )
  ) {
    overallScore = Math.min(overallScore, 49);
  }

  return {
    dataQualityScore,
    channelCompatibilityScore,
    complianceSafetyScore,
    marginHealthScore,
    overallScore,
    scoreVersion: "1.0.0"
  };
}
