import type { CanonicalProduct, ChannelPreview, DiagnosticIssue, MetadataSnapshot, PriceResult } from "./types.ts";

export function buildCoupangPreview(product: CanonicalProduct, metadata: MetadataSnapshot, price: PriceResult,
  issues: DiagnosticIssue[], now: Date): ChannelPreview {
  const category = metadata.categories.find((item) => item.internalCategoryCode === product.internalCategoryCode);
  const buildErrors = issues.filter((issue) => issue.severity === "BLOCKED").map((issue) => issue.ruleId);
  const publishReady = metadata.sourceType !== "FIXTURE" && buildErrors.length === 0;
  const envelope: ChannelPreview = {
    channel: "COUPANG_KR", nonExecutable: true, metadataTrust: metadata.sourceType, publishReady,
    previewScope: "REQUEST_BODY",
    previewNote: "요청 본문 기준 사전보기입니다. 쿠팡의 검증·카탈로그 처리 결과에 따라 최종 노출 정보가 달라질 수 있습니다.",
    assumptions: ["외부 전송 없음", "requested=false", `metadata=${metadata.version}`], buildErrors
  };
  if (!category || buildErrors.length) return envelope;
  const sku = product.skus[0];
  const gtin = sku.identifiers.find((item) => item.type === "GTIN")?.value;
  const model = sku.identifiers.find((item) => item.type === "MODEL_NO" || item.type === "MPN")?.value;
  envelope.requestBody = {
    displayCategoryCode: category.displayCategoryCode, sellerProductName: product.titleStandard,
    vendorId: "PREVIEW_VENDOR", saleStartedAt: now.toISOString().slice(0, 19), saleEndedAt: "2099-01-01T23:59:59",
    displayProductName: product.titleStandard, brand: product.brand.mode === "BRANDED" ? product.brand.name : "",
    generalProductName: product.titleStandard, deliveryMethod: category.deliveryMethod,
    deliveryCompanyCode: "PREVIEW", deliveryChargeType: "FREE", deliveryCharge: 0,
    remoteAreaDeliverable: "N", unionDeliveryType: "UNION_DELIVERY", outboundShippingPlaceCode: "PREVIEW_OUTBOUND",
    returnCenterCode: "PREVIEW_RETURN", returnChargeName: "미리보기 반품지", companyContactNumber: "000-0000-0000",
    returnZipCode: "00000", returnAddress: "PREVIEW", returnAddressDetail: "PREVIEW", returnCharge: 0,
    vendorUserId: "PREVIEW_USER", requested: false,
    items: [{
      itemName: sku.options.map((option) => `${option.name}:${option.normalized?.normalizedText || option.value}`).join(", "),
      originalPrice: price.listPrice, salePrice: price.sellPrice, maximumBuyCount: Math.min(sku.stock, 99_999),
      maximumBuyForPerson: 0, maximumBuyForPersonPeriod: 1, outboundShippingTimeDay: 1, unitCount: 1,
      adultOnly: "EVERYONE", taxType: sku.taxType, externalVendorSku: sku.skuCode,
      ...(gtin ? { barcode: gtin, emptyBarcode: false } : { emptyBarcode: true, emptyBarcodeReason: sku.identifierExemptionReason }),
      ...(model ? { modelNo: model } : {}),
      attributes: sku.options.map((option) => ({ attributeTypeName: option.name,
        attributeValueName: option.normalized?.normalizedText || option.value })),
      notices: Object.entries(product.disclosure.fields).map(([noticeCategoryDetailName, content]) => ({
        noticeCategoryName: product.disclosure.noticeCategoryName, noticeCategoryDetailName, content })),
      images: product.images.map((image) => ({ imageOrder: image.order, imageType: image.type, cdnPath: image.sourceUrl })),
      contents: [{ contentsType: "HTML", contentDetails: [{ content: product.descriptionHtml ?? "", detailType: "TEXT" }] }]
    }]
  };
  return envelope;
}
