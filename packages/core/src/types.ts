export type Severity = "INFO" | "WARNING" | "BLOCKED";
export type Verdict = "PASS" | "WARNING" | "BLOCKED";
export type MetadataTrust = "FIXTURE" | "OFFICIAL_FILE" | "API";
export type BrandMode = "BRANDED" | "UNBRANDED" | "UNKNOWN";
export type TaxType = "TAX" | "FREE";
export type CompliancePack = "AGRI_KR" | "HEALTH_SUPPLEMENT_KR" | "GENERAL_GOODS_KR" | "OVERSEAS_KR";
export type IdentifierType = "GTIN" | "MPN" | "MODEL_NO";
export type IdentifierExemptionReason = "UNBRANDED" | "HANDMADE" | "CUSTOM_MADE" | "NO_OFFICIAL_IDENTIFIER" | "NOT_APPLICABLE";

export interface ProductIdentifier { type: IdentifierType; value: string; source: "SUPPLIER" | "MANUFACTURER" | "OFFICIAL_SITE" | "MANUAL"; }
export interface BrandIdentity { mode: BrandMode; name?: string; }
export interface ProductImage { type: "REPRESENTATION" | "DETAIL"; sourceUrl?: string; localPath?: string; order: number; rightsConfirmed: boolean; inspectionStatus: "NOT_INSPECTED" | "INSPECTED" | "FAILED"; widthPx?: number; heightPx?: number; sizeBytes?: number; format?: "jpg" | "png"; }
export interface NormalizedAttributeValue { raw: string; numericValue?: number; unitRaw?: string; unitCanonical?: string; normalizedText: string; parseStatus: "PARSED" | "TEXT_ONLY" | "AMBIGUOUS" | "FAILED"; }
export interface OptionAttribute { name: string; value: string; normalized?: NormalizedAttributeValue; }
export interface PricePolicy { cost: number; supplierShipFee: number; fixedCost: number; platformFeeBp: number; adReserveBp: number; returnReserveBp: number; paymentReserveBp: number; targetContributionMarginBp: number; roundingMode: "NONE" | "CEIL_100" | "END_900" | "END_990"; minPriceFloor?: number; }
export interface PriceResult { baseCost: number; variableFeeBp: number; denominatorBp: number; rawRequiredPrice: number; sellPrice: number; listPrice: number; estimatedVariableCost: number; contributionProfit: number; contributionMarginBp: number; verdict: Verdict; calculationVersion: "1.1.0"; }
export interface CanonicalSku { skuCode: string; options: OptionAttribute[]; identifiers: ProductIdentifier[]; identifierExemptionReason?: IdentifierExemptionReason; pricePolicy: PricePolicy; stock: number; weightGrams?: number; taxType: TaxType; }
export interface CanonicalProduct { schemaVersion: "1.1.0"; internalCode: string; supplierId: string; supplierSku: string; titleRaw: string; titleStandard: string; brand: BrandIdentity; manufacturer: string; originCountry: string; originDisplay: string; internalCategoryCode: string; descriptionHtml?: string; images: ProductImage[]; skus: CanonicalSku[]; disclosure: { noticeCategoryName: string; fields: Record<string, string>; }; compliancePack: CompliancePack; deliveryPolicyCode: string; returnPolicyCode: string; status: "DRAFT"; }
export interface DiagnosticIssue { ruleId: string; severity: Severity; scope: "FILE" | "ROW" | "PRODUCT" | "SKU" | "IMAGE" | "PRICE" | "METADATA" | "PAYLOAD"; field?: string; message: string; fix?: string; evidence?: Record<string, unknown>; autoFixable?: boolean; suggestedValue?: unknown; }
export interface CategoryMetadata { internalCategoryCode: string; displayCategoryCode: number | null; categoryName: string; requiredAttributes: Array<{ attributeTypeName: string; required: boolean; allowedUnits: string[]; }>; noticeCategoryName: string; noticeRequiredFields: string[]; brandRequired: boolean; deliveryMethod: "SEQUENCIAL" | "COLD_FRESH" | "MAKE_ORDER" | "AGENT_BUY" | "VENDOR_DIRECT"; }
export interface MetadataSnapshot { id: string; version: string; sourceType: MetadataTrust; retrievedAt: string; categories: CategoryMetadata[]; }
export interface ReadinessScores { dataQualityScore: number; channelCompatibilityScore: number; complianceSafetyScore: number; marginHealthScore: number; overallScore: number; scoreVersion: "1.0.0"; }
export interface ChannelPreview { channel: "COUPANG_KR"; nonExecutable: true; metadataTrust: MetadataTrust; publishReady: boolean; previewScope: "REQUEST_BODY"; previewNote: string; assumptions: string[]; requestBody?: Record<string, unknown>; buildErrors: string[]; }
export interface DiagnosisItem { sourceRow: number; supplierId: string; supplierSku: string; internalCode?: string; verdict: Verdict; issues: DiagnosticIssue[]; canonical?: CanonicalProduct; price?: PriceResult; readiness: ReadinessScores; coupangPayloadPreview?: ChannelPreview; source: Record<string, string>; }
export interface DiagnosisReport { reportVersion: "1.1.0"; generatedAt: string; run: { id: string; inputFilename: string; inputSha256: string; rowCount: number; metadataTrust: MetadataTrust; metadataVersion: string; publishReady: boolean; }; summary: { processed: number; pass: number; warning: number; blocked: number; rowErrors: number; }; rootCauses: Array<{ ruleId: string; severity: Severity; count: number; autoFixable: number; }>; items: DiagnosisItem[]; }
export interface Clock { now(): Date }
