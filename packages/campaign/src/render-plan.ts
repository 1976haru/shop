import { z } from "zod";
import {
  hybridCampaignSchema,
  sceneTypeSchema,
  type HybridCampaign
} from "./schema.ts";

/**
 * R1 렌더 계획(순수).
 * 크리에이티브를 ffmpeg 등 렌더러가 실행할 수 있는 결정적 계획으로 변환한다.
 *
 * 핵심 불변식(FACT_SOURCE_MISMATCH 예방):
 * - PRICE_CARD / CTA_CARD 의 모든 텍스트·숫자는 campaign(offer/input.product/creative)
 *   에서만 파생된다. 이 모듈은 임의 문자열 입력 경로를 제공하지 않는다.
 * - 승인(APPROVED)되지 않은 캠페인은 계획 생성 자체를 거부한다.
 */

export const renderScenePlanSchema = z.object({
  order: z.number().int().positive(),
  sceneType: sceneTypeSchema,
  startSecond: z.number().nonnegative(),
  endSecond: z.number().positive(),
  durationSeconds: z.number().positive(),
  caption: z.string().min(1),
  narration: z.string().min(1),
  /** PRODUCT_KENBURNS 전용: 사용할 이미지 슬롯(R1은 대표 이미지 1장) */
  imageSlot: z.literal("PRIMARY").optional(),
  priceCard: z
    .object({
      productTitle: z.string().min(1),
      sellPriceKrw: z.number().int().nonnegative(),
      listPriceKrw: z.number().int().nonnegative().optional(),
      optionSummary: z.string().min(1),
      originDisplay: z.string().min(1)
    })
    .optional(),
  ctaCard: z
    .object({
      callToAction: z.string().min(1),
      disclosureText: z.string().min(1),
      landingUrl: z.string().url().optional()
    })
    .optional()
});

export const renderPlanSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  campaignId: z.string().min(1),
  creativeId: z.string().min(1),
  width: z.literal(720),
  height: z.literal(1280),
  fps: z.literal(30),
  totalDurationSeconds: z.number().positive(),
  scenes: z.array(renderScenePlanSchema).min(1),
  subtitleSrt: z.string().min(1),
  disclosureText: z.string().min(1)
});

export type RenderPlan = z.infer<typeof renderPlanSchema>;
export type RenderScenePlan = z.infer<typeof renderScenePlanSchema>;

export class RenderPlanError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RenderPlanError";
    this.code = code;
  }
}

/**
 * 결정적 씬 타입 유추(하위호환).
 * - scene.sceneType 명시가 항상 우선
 * - 마지막 씬 → CTA_CARD
 * - sellPrice가 있으면 끝에서 두 번째 씬 → PRICE_CARD
 * - 나머지 → PRODUCT_KENBURNS
 */
function inferSceneType(
  index: number,
  total: number,
  hasSellPrice: boolean,
  explicit?: z.infer<typeof sceneTypeSchema>
): z.infer<typeof sceneTypeSchema> {
  if (explicit) return explicit;
  if (index === total - 1) return "CTA_CARD";
  if (hasSellPrice && index === total - 2) return "PRICE_CARD";
  return "PRODUCT_KENBURNS";
}

export function buildRenderPlan(
  campaignInput: unknown,
  creativeId: string
): RenderPlan {
  const campaign: HybridCampaign = hybridCampaignSchema.parse(campaignInput);

  if (campaign.approvalStatus !== "APPROVED") {
    throw new RenderPlanError(
      "CAMPAIGN_NOT_APPROVED",
      `승인되지 않은 캠페인은 렌더할 수 없습니다 (현재 상태: ${campaign.approvalStatus}). 승인 후 다시 시도하세요.`
    );
  }

  const blocked = campaign.safetyIssues.filter((i) => i.severity === "BLOCKED");
  if (blocked.length > 0) {
    throw new RenderPlanError(
      "CAMPAIGN_BLOCKED",
      `차단(BLOCKED) 이슈가 있는 캠페인은 렌더할 수 없습니다: ${blocked
        .map((i) => i.code)
        .join(", ")}`
    );
  }

  const creative = campaign.creatives.find((c) => c.id === creativeId);
  if (!creative) {
    throw new RenderPlanError(
      "CREATIVE_NOT_FOUND",
      `크리에이티브를 찾을 수 없습니다: ${creativeId}`
    );
  }

  const hasSellPrice = typeof campaign.offer.sellPrice === "number";
  const total = creative.scenes.length;

  const scenes: RenderScenePlan[] = creative.scenes.map((scene, index) => {
    const sceneType = inferSceneType(index, total, hasSellPrice, scene.sceneType);
    const base = {
      order: scene.order,
      sceneType,
      startSecond: scene.startSecond,
      endSecond: scene.endSecond,
      durationSeconds: Math.max(0.1, scene.endSecond - scene.startSecond),
      caption: scene.caption,
      narration: scene.narration
    };

    if (sceneType === "PRICE_CARD") {
      // 사실 고정: 값은 campaign에서만 파생
      return {
        ...base,
        priceCard: {
          productTitle: campaign.input.product.title,
          sellPriceKrw: campaign.offer.sellPrice ?? 0,
          listPriceKrw: campaign.offer.listPrice,
          optionSummary: campaign.input.product.optionSummary,
          originDisplay: campaign.input.product.originDisplay
        }
      };
    }
    if (sceneType === "CTA_CARD") {
      return {
        ...base,
        ctaCard: {
          callToAction: campaign.offer.callToAction,
          disclosureText: creative.disclosureText,
          landingUrl: campaign.offer.landingUrl
        }
      };
    }
    return { ...base, imageSlot: "PRIMARY" as const };
  });

  const plan: RenderPlan = {
    schemaVersion: "1.0.0",
    campaignId: campaign.id,
    creativeId: creative.id,
    width: 720,
    height: 1280,
    fps: 30,
    totalDurationSeconds: creative.renderManifest.durationSeconds,
    scenes,
    subtitleSrt: creative.subtitleSrt,
    disclosureText: creative.disclosureText
  };

  return renderPlanSchema.parse(plan);
}

/** 원화 표기(렌더러 공용): 19900 → "19,900원" */
export function formatKrw(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}
