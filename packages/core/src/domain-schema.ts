import { z } from "zod";

export const severitySchema = z.enum(["INFO", "WARNING", "BLOCKED"]);
export const verdictSchema = z.enum(["PASS", "WARNING", "BLOCKED"]);
export const metadataTrustSchema = z.enum(["FIXTURE", "OFFICIAL_FILE", "API"]);
export const brandModeSchema = z.enum(["BRANDED", "UNBRANDED", "UNKNOWN"]);
export const taxTypeSchema = z.enum(["TAX", "FREE"]);
export const compliancePackSchema = z.enum(["AGRI_KR", "HEALTH_SUPPLEMENT_KR", "GENERAL_GOODS_KR", "OVERSEAS_KR"]);
export const identifierTypeSchema = z.enum(["GTIN", "MPN", "MODEL_NO"]);
export const identifierExemptionReasonSchema = z.enum(["UNBRANDED", "HANDMADE", "CUSTOM_MADE", "NO_OFFICIAL_IDENTIFIER", "NOT_APPLICABLE"]);
export const runStatusSchema = z.enum(["COMPLETED", "PARTIAL"]);

export const productIdentifierSchema = z.object({
  type: identifierTypeSchema,
  value: z.string().min(1).max(100),
  source: z.enum(["SUPPLIER", "MANUFACTURER", "OFFICIAL_SITE", "MANUAL"])
});

export const brandIdentitySchema = z.object({
  mode: brandModeSchema,
  name: z.string().min(1).max(100).optional()
});

export const productImageSchema = z.object({
  type: z.enum(["REPRESENTATION", "DETAIL"]),
  sourceUrl: z.string().url().optional(),
  localPath: z.string().min(1).optional(),
  order: z.number().int().nonnegative(),
  rightsConfirmed: z.boolean(),
  inspectionStatus: z.enum(["NOT_INSPECTED", "INSPECTED", "FAILED"]),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  format: z.enum(["jpg", "png"]).optional()
});

export const normalizedAttributeValueSchema = z.object({
  raw: z.string(),
  numericValue: z.number().finite().optional(),
  unitRaw: z.string().optional(),
  unitCanonical: z.string().optional(),
  normalizedText: z.string(),
  parseStatus: z.enum(["PARSED", "TEXT_ONLY", "AMBIGUOUS", "FAILED"])
});

export const optionAttributeSchema = z.object({
  name: z.string().min(1).max(25),
  value: z.string().min(1).max(100),
  normalized: normalizedAttributeValueSchema.optional()
});

export const pricePolicySchema = z.object({
  cost: z.number().int().min(0).max(1_000_000_000),
  supplierShipFee: z.number().int().min(0).max(1_000_000_000),
  fixedCost: z.number().int().min(0).max(1_000_000_000),
  platformFeeBp: z.number().int().min(0).max(10_000),
  adReserveBp: z.number().int().min(0).max(10_000),
  returnReserveBp: z.number().int().min(0).max(10_000),
  paymentReserveBp: z.number().int().min(0).max(10_000),
  targetContributionMarginBp: z.number().int().min(0).max(10_000),
  roundingMode: z.enum(["NONE", "CEIL_100", "END_900", "END_990"]),
  minPriceFloor: z.number().int().min(0).max(1_000_000_000).optional()
});

export const priceResultSchema = z.object({
  baseCost: z.number().int(),
  variableFeeBp: z.number().int(),
  denominatorBp: z.number().int(),
  rawRequiredPrice: z.number().int(),
  sellPrice: z.number().int(),
  listPrice: z.number().int(),
  estimatedVariableCost: z.number().int(),
  contributionProfit: z.number().int(),
  contributionMarginBp: z.number().int(),
  verdict: verdictSchema,
  calculationVersion: z.literal("1.1.0")
});

export const canonicalSkuSchema = z.object({
  skuCode: z.string().min(1).max(100),
  options: z.array(optionAttributeSchema).min(1).max(50),
  identifiers: z.array(productIdentifierSchema),
  identifierExemptionReason: identifierExemptionReasonSchema.optional(),
  pricePolicy: pricePolicySchema,
  stock: z.number().int().min(0).max(99_999),
  weightGrams: z.number().int().positive().max(1_000_000_000).optional(),
  taxType: taxTypeSchema
});

export const canonicalProductSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  internalCode: z.string().regex(/^P-[A-F0-9]{12}$/),
  supplierId: z.string().min(1).max(100),
  supplierSku: z.string().min(1).max(100),
  titleRaw: z.string().min(1).max(500),
  titleStandard: z.string().min(1).max(500),
  brand: brandIdentitySchema,
  manufacturer: z.string().min(1).max(100),
  originCountry: z.string().regex(/^[A-Z]{2}$/),
  originDisplay: z.string().min(1).max(100),
  internalCategoryCode: z.string().min(1).max(100),
  descriptionHtml: z.string().max(200_000).optional(),
  images: z.array(productImageSchema).min(1).max(10),
  skus: z.array(canonicalSkuSchema).min(1).max(200),
  disclosure: z.object({
    noticeCategoryName: z.string().min(1),
    fields: z.record(z.string(), z.string())
  }),
  compliancePack: compliancePackSchema,
  deliveryPolicyCode: z.string().min(1).max(100),
  returnPolicyCode: z.string().min(1).max(100),
  status: z.literal("DRAFT")
});

export const diagnosticIssueSchema = z.object({
  ruleId: z.string().min(1),
  severity: severitySchema,
  scope: z.enum(["FILE", "ROW", "PRODUCT", "SKU", "IMAGE", "PRICE", "METADATA", "PAYLOAD"]),
  field: z.string().optional(),
  message: z.string().min(1),
  fix: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  autoFixable: z.boolean().optional(),
  suggestedValue: z.unknown().optional()
});

export const categoryMetadataSchema = z.object({
  internalCategoryCode: z.string().min(1),
  displayCategoryCode: z.number().int().positive().nullable(),
  categoryName: z.string().min(1),
  requiredAttributes: z.array(z.object({
    attributeTypeName: z.string().min(1),
    required: z.boolean(),
    allowedUnits: z.array(z.string())
  })),
  noticeCategoryName: z.string().min(1),
  noticeRequiredFields: z.array(z.string()),
  brandRequired: z.boolean(),
  deliveryMethod: z.enum(["SEQUENCIAL", "COLD_FRESH", "MAKE_ORDER", "AGENT_BUY", "VENDOR_DIRECT"])
});

export const metadataSnapshotSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  sourceType: metadataTrustSchema,
  retrievedAt: z.string().datetime(),
  categories: z.array(categoryMetadataSchema)
});

export const readinessScoresSchema = z.object({
  dataQualityScore: z.number().int().min(0).max(100),
  channelCompatibilityScore: z.number().int().min(0).max(100),
  complianceSafetyScore: z.number().int().min(0).max(100),
  marginHealthScore: z.number().int().min(0).max(100),
  overallScore: z.number().int().min(0).max(100),
  scoreVersion: z.literal("1.0.0")
});

export const channelPreviewSchema = z.object({
  channel: z.literal("COUPANG_KR"),
  nonExecutable: z.literal(true),
  metadataTrust: metadataTrustSchema,
  publishReady: z.boolean(),
  previewScope: z.literal("REQUEST_BODY"),
  previewNote: z.string().min(1),
  assumptions: z.array(z.string()),
  requestBody: z.record(z.string(), z.unknown()).optional(),
  buildErrors: z.array(z.string())
});

export const diagnosisItemSchema = z.object({
  sourceRow: z.number().int().min(2),
  supplierId: z.string(),
  supplierSku: z.string(),
  internalCode: z.string().optional(),
  verdict: verdictSchema,
  issues: z.array(diagnosticIssueSchema),
  canonical: canonicalProductSchema.optional(),
  price: priceResultSchema.optional(),
  readiness: readinessScoresSchema,
  coupangPayloadPreview: channelPreviewSchema.optional(),
  source: z.record(z.string(), z.string())
});

export const diagnosisReportSchema = z.object({
  reportVersion: z.literal("1.2.0"),
  generatedAt: z.string().datetime(),
  run: z.object({
    id: z.string().min(1),
    status: runStatusSchema,
    inputFilename: z.string().min(1),
    inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
    rowCount: z.number().int().nonnegative(),
    metadataTrust: metadataTrustSchema,
    metadataVersion: z.string().min(1),
    pricePolicy: pricePolicySchema,
    publishReady: z.boolean()
  }),
  summary: z.object({
    processed: z.number().int().nonnegative(),
    pass: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    rowErrors: z.number().int().nonnegative()
  }),
  rootCauses: z.array(z.object({
    ruleId: z.string(),
    severity: severitySchema,
    count: z.number().int().nonnegative(),
    autoFixable: z.number().int().nonnegative()
  })),
  items: z.array(diagnosisItemSchema)
});
