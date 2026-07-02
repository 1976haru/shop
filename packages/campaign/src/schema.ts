import { z } from "zod";

export const campaignObjectiveSchema = z.enum([
  "AWARENESS",
  "TRAFFIC",
  "CONVERSION"
]);

export const campaignToneSchema = z.enum([
  "TRUSTWORTHY",
  "FRIENDLY",
  "ENERGETIC",
  "PREMIUM"
]);

export const shortChannelSchema = z.enum([
  "YOUTUBE_SHORTS",
  "INSTAGRAM_REELS",
  "TIKTOK",
  "NAVER_CLIP"
]);

export const disclosureTypeSchema = z.enum([
  "DIRECT_SALE",
  "AFFILIATE",
  "SPONSORED",
  "FREE_PRODUCT",
  "NONE"
]);

export const creativeAngleSchema = z.enum([
  "PROBLEM_SOLVING",
  "INFORMATION",
  "CONVERSION"
]);

export const campaignApprovalStatusSchema = z.enum([
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED"
]);

export const campaignProductSchema = z.object({
  sourceRunId: z.string().min(1),
  sourceItemIndex: z.number().int().nonnegative(),
  internalCode: z.string().optional(),
  supplierSku: z.string().min(1),
  title: z.string().min(1).max(500),
  brand: z.string().max(100).optional(),
  manufacturer: z.string().min(1).max(100),
  originDisplay: z.string().min(1).max(100),
  optionSummary: z.string().min(1).max(300),
  sellPrice: z.number().int().nonnegative().optional(),
  listPrice: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  categoryCode: z.string().max(100).optional(),
  compliancePack: z.string().max(100).optional()
});

export const campaignEvidenceSchema = z.object({
  originConfirmed: z.boolean(),
  imageRightsConfirmed: z.boolean(),
  factsConfirmed: z.boolean()
});

export const campaignInputSchema = z.object({
  campaignName: z.string().min(1).max(200),
  objective: campaignObjectiveSchema,
  targetAudience: z.string().min(1).max(300),
  tone: campaignToneSchema,
  durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45)]),
  channels: z.array(shortChannelSchema).min(1),
  disclosureType: disclosureTypeSchema,
  landingUrl: z.string().url().optional(),
  forbiddenClaims: z.array(z.string().min(1).max(200)).max(30).default([]),
  evidence: campaignEvidenceSchema,
  product: campaignProductSchema
});

export const sceneTypeSchema = z.enum(["PRODUCT_KENBURNS", "PRICE_CARD", "CTA_CARD"]);

export const shortSceneSchema = z.object({
  order: z.number().int().positive(),
  startSecond: z.number().nonnegative(),
  endSecond: z.number().positive(),
  visualDirection: z.string().min(1),
  caption: z.string().min(1).max(180),
  narration: z.string().min(1).max(300),
  // R1: 미지정 시 렌더 계획 단계에서 결정적으로 유추(하위호환)
  sceneType: sceneTypeSchema.optional()
});

export const creativeVariantSchema = z.object({
  id: z.string().min(1),
  angle: creativeAngleSchema,
  name: z.string().min(1),
  hook: z.string().min(1).max(180),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2_000),
  pinnedComment: z.string().min(1).max(500),
  hashtags: z.array(z.string().min(2).max(60)).min(3).max(15),
  disclosureText: z.string().min(1).max(300),
  scenes: z.array(shortSceneSchema).min(4).max(8),
  subtitleSrt: z.string().min(1),
  renderManifest: z.object({
    width: z.literal(720),
    height: z.literal(1280),
    aspectRatio: z.literal("9:16"),
    durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45)]),
    requiresHumanReview: z.literal(true),
    outputPreference: z.enum(["MP4_IF_SUPPORTED", "WEBM_FALLBACK"])
  })
});

export const campaignSafetyIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["WARNING", "BLOCKED"]),
  message: z.string().min(1),
  fix: z.string().min(1)
});

export const performanceSnapshotSchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().datetime(),
  channel: shortChannelSchema,
  creativeId: z.string().min(1),
  views: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  revenue: z.number().int().nonnegative(),
  adSpend: z.number().int().nonnegative(),
  clickThroughRateBp: z.number().int().nonnegative(),
  orderConversionRateBp: z.number().int().nonnegative(),
  returnOnAdSpendBp: z.number().int().nonnegative().optional(),
  note: z.string().max(500).optional()
});

export const campaignInsightSchema = z.object({
  type: z.enum(["NO_DATA", "LOW_CTR", "LOW_CONVERSION", "POSITIVE", "MIXED"]),
  message: z.string().min(1),
  nextAction: z.string().min(1)
});

export const hybridCampaignSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvalStatus: campaignApprovalStatusSchema,
  input: campaignInputSchema,
  offer: z.object({
    channelTitle: z.string().min(1).max(500),
    sellPrice: z.number().int().nonnegative().optional(),
    listPrice: z.number().int().nonnegative().optional(),
    landingUrl: z.string().url().optional(),
    callToAction: z.string().min(1).max(200)
  }),
  creatives: z.array(creativeVariantSchema).length(3),
  safetyIssues: z.array(campaignSafetyIssueSchema),
  performanceSnapshots: z.array(performanceSnapshotSchema),
  insight: campaignInsightSchema
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type HybridCampaign = z.infer<typeof hybridCampaignSchema>;
export type CreativeVariant = z.infer<typeof creativeVariantSchema>;
export type PerformanceSnapshot = z.infer<typeof performanceSnapshotSchema>;
export type ShortChannel = z.infer<typeof shortChannelSchema>;
