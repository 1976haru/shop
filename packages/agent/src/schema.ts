import { z } from "zod";
import { pricePolicySchema } from "../../core/src/domain-schema.ts";

export const agentThemeSchema = z.enum([
  "AGRI_KR",
  "GENERAL_HEALTH_FOOD_KR",
  "HEALTH_SUPPLEMENT_KR"
]);

export const agentModeSchema = z.enum(["DEMO", "LIVE"]);
export const agentSourceIdSchema = z.enum([
  "FIXTURE",
  "SUPPLIER_CSV",
  "KAMIS",
  "NAVER_TREND",
  "FOOD_SAFETY_KOREA"
]);
export const agentSourceStatusSchema = z.enum([
  "USED",
  "READY",
  "UNAVAILABLE",
  "FAILED",
  "SKIPPED"
]);
export const complianceGateSchema = z.enum(["PASS", "WARNING", "BLOCKED"]);

export const agentEvidenceSchema = z.object({
  source: agentSourceIdSchema,
  label: z.string().min(1),
  capturedAt: z.string().datetime(),
  freshness: z.enum(["LIVE", "RECENT", "STALE", "FIXTURE"]),
  reference: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
});

export const agentSourceStateSchema = z.object({
  source: agentSourceIdSchema,
  status: agentSourceStatusSchema,
  message: z.string(),
  collectedAt: z.string().datetime().optional(),
  recordCount: z.number().int().nonnegative().default(0)
});

export const opportunityCandidateInputSchema = z.object({
  id: z.string().min(1),
  theme: agentThemeSchema,
  name: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1)).min(1),
  supplierSku: z.string().optional(),
  cost: z.number().int().min(0).max(1_000_000_000).optional(),
  supplierShipFee: z.number().int().min(0).max(1_000_000_000).default(0),
  fixedCost: z.number().int().min(0).max(1_000_000_000).default(0),
  marketPrice: z.number().int().positive().max(1_000_000_000).optional(),
  stock: z.number().int().min(0).max(99_999).optional(),
  demandTrendScore: z.number().min(0).max(100).default(50),
  seasonalityScore: z.number().min(0).max(100).default(50),
  competitionAttractivenessScore: z.number().min(0).max(100).default(50),
  priceStabilityScore: z.number().min(0).max(100).default(50),
  supplyStabilityScore: z.number().min(0).max(100).default(50),
  operationEaseScore: z.number().min(0).max(100).default(50),
  shippingRiskScore: z.number().min(0).max(100).default(50),
  complianceGate: complianceGateSchema.default("WARNING"),
  complianceReasons: z.array(z.string()).default([]),
  evidence: z.array(agentEvidenceSchema).default([])
});

export const agentSellerProfileSchema = z.object({
  healthSupplementBusinessReported: z.boolean().default(false),
  imageRightsConfirmed: z.boolean().default(false),
  originEvidenceAvailable: z.boolean().default(false)
});

export const agentRunRequestSchema = z.object({
  theme: agentThemeSchema,
  mode: agentModeSchema.default("DEMO"),
  topN: z.number().int().min(1).max(50).default(10),
  supplierCsvText: z.string().optional(),
  sellerProfile: agentSellerProfileSchema.default({
    healthSupplementBusinessReported: false,
    imageRightsConfirmed: false,
    originEvidenceAvailable: false
  })
});

export const agentPlanStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["COMPLETED", "PARTIAL", "SKIPPED", "FAILED"]),
  detail: z.string()
});

export const opportunityScoreSchema = z.object({
  marketScore: z.number().int().min(0).max(100),
  profitScore: z.number().int().min(0).max(100),
  supplyScore: z.number().int().min(0).max(100),
  operationScore: z.number().int().min(0).max(100),
  overallScore: z.number().int().min(0).max(100),
  estimatedMarginBp: z.number().int().optional(),
  requiredSellPrice: z.number().int().optional(),
  marketPrice: z.number().int().optional()
});

export const opportunityResultSchema = z.object({
  candidateId: z.string(),
  rank: z.number().int().positive(),
  theme: agentThemeSchema,
  name: z.string(),
  supplierSku: z.string().optional(),
  gate: complianceGateSchema,
  gateReasons: z.array(z.string()),
  recommendation: z.enum([
    "PRIORITY_REVIEW",
    "NEGOTIATE_OR_IMPROVE",
    "WATCHLIST",
    "EXCLUDE",
    "BLOCKED"
  ]),
  scores: opportunityScoreSchema,
  whyRecommended: z.array(z.string()),
  risks: z.array(z.string()),
  nextActions: z.array(z.string()),
  evidence: z.array(agentEvidenceSchema),
  humanApprovalRequired: z.literal(true)
});

export const agentRunSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string(),
  createdAt: z.string().datetime(),
  theme: agentThemeSchema,
  mode: agentModeSchema,
  executionStatus: z.enum(["COMPLETED", "PARTIAL", "FAILED"]),
  approvalStatus: z.enum(["AWAITING_APPROVAL", "APPROVED", "REJECTED"]),
  approvedCandidateIds: z.array(z.string()).default([]),
  approvedAt: z.string().datetime().optional(),
  noExternalWrite: z.literal(true),
  pricePolicy: pricePolicySchema,
  plan: z.array(agentPlanStepSchema),
  sources: z.array(agentSourceStateSchema),
  candidates: z.array(opportunityResultSchema),
  summary: z.object({
    collectedCandidates: z.number().int().nonnegative(),
    priorityReview: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    sourceFailures: z.number().int().nonnegative()
  }),
  warnings: z.array(z.string())
});

export type AgentTheme = z.infer<typeof agentThemeSchema>;
export type AgentMode = z.infer<typeof agentModeSchema>;
export type AgentSourceId = z.infer<typeof agentSourceIdSchema>;
export type AgentSourceState = z.infer<typeof agentSourceStateSchema>;
export type AgentEvidence = z.infer<typeof agentEvidenceSchema>;
export type OpportunityCandidateInput = z.infer<typeof opportunityCandidateInputSchema>;
export type AgentSellerProfile = z.infer<typeof agentSellerProfileSchema>;
export type AgentRunRequest = z.infer<typeof agentRunRequestSchema>;
export type OpportunityResult = z.infer<typeof opportunityResultSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
