import type { z } from "zod";
import {
  brandIdentitySchema,
  brandModeSchema,
  canonicalProductSchema,
  canonicalSkuSchema,
  categoryMetadataSchema,
  channelPreviewSchema,
  compliancePackSchema,
  diagnosisItemSchema,
  diagnosisReportSchema,
  diagnosticIssueSchema,
  identifierExemptionReasonSchema,
  identifierTypeSchema,
  metadataSnapshotSchema,
  metadataTrustSchema,
  normalizedAttributeValueSchema,
  optionAttributeSchema,
  pricePolicySchema,
  priceResultSchema,
  productIdentifierSchema,
  productImageSchema,
  readinessScoresSchema,
  runStatusSchema,
  severitySchema,
  taxTypeSchema,
  verdictSchema
} from "./domain-schema.ts";

export type Severity = z.infer<typeof severitySchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type MetadataTrust = z.infer<typeof metadataTrustSchema>;
export type BrandMode = z.infer<typeof brandModeSchema>;
export type TaxType = z.infer<typeof taxTypeSchema>;
export type CompliancePack = z.infer<typeof compliancePackSchema>;
export type IdentifierType = z.infer<typeof identifierTypeSchema>;
export type IdentifierExemptionReason = z.infer<typeof identifierExemptionReasonSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type ProductIdentifier = z.infer<typeof productIdentifierSchema>;
export type BrandIdentity = z.infer<typeof brandIdentitySchema>;
export type ProductImage = z.infer<typeof productImageSchema>;
export type NormalizedAttributeValue = z.infer<typeof normalizedAttributeValueSchema>;
export type OptionAttribute = z.infer<typeof optionAttributeSchema>;
export type PricePolicy = z.infer<typeof pricePolicySchema>;
export type PriceResult = z.infer<typeof priceResultSchema>;
export type CanonicalSku = z.infer<typeof canonicalSkuSchema>;
export type CanonicalProduct = z.infer<typeof canonicalProductSchema>;
export type DiagnosticIssue = z.infer<typeof diagnosticIssueSchema>;
export type CategoryMetadata = z.infer<typeof categoryMetadataSchema>;
export type MetadataSnapshot = z.infer<typeof metadataSnapshotSchema>;
export type ReadinessScores = z.infer<typeof readinessScoresSchema>;
export type ChannelPreview = z.infer<typeof channelPreviewSchema>;
export type DiagnosisItem = z.infer<typeof diagnosisItemSchema>;
export type DiagnosisReport = z.infer<typeof diagnosisReportSchema>;

export interface Clock {
  now(): Date;
}
