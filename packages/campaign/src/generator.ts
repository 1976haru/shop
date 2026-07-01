import {
  campaignInputSchema,
  hybridCampaignSchema,
  performanceSnapshotSchema,
  type CampaignInput,
  type CreativeVariant,
  type HybridCampaign,
  type PerformanceSnapshot
} from "./schema.ts";

const disclosureByType: Record<CampaignInput["disclosureType"], string> = {
  DIRECT_SALE: "이 콘텐츠는 판매자가 직접 판매하는 상품을 소개합니다.",
  AFFILIATE: "이 콘텐츠에는 구매 시 수익이 발생할 수 있는 제휴 링크가 포함되어 있습니다.",
  SPONSORED: "이 콘텐츠는 유료 광고를 포함하고 있습니다.",
  FREE_PRODUCT: "이 콘텐츠는 제품을 무상으로 제공받아 제작했습니다.",
  NONE: "이 콘텐츠에는 광고·협찬·제휴 관계가 없습니다."
};

const toneLead: Record<CampaignInput["tone"], string> = {
  TRUSTWORTHY: "구매 전 확인해야 할 정보를 차분하게 정리합니다.",
  FRIENDLY: "처음 보는 분도 이해하기 쉽게 알려드립니다.",
  ENERGETIC: "핵심만 빠르게 확인해 보세요.",
  PREMIUM: "구성과 정보를 꼼꼼히 살펴보세요."
};

function cleanToken(value: string): string {
  return value.replace(/[^0-9A-Za-z가-힣]/g, "").slice(0, 30);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function formatPrice(value: number | undefined): string {
  return value === undefined ? "가격은 판매페이지에서 확인" : `${value.toLocaleString("ko-KR")}원`;
}

function secondsToSrt(value: number): string {
  const totalMs = Math.round(value * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function buildSrt(scenes: CreativeVariant["scenes"]): string {
  return scenes.map((scene, index) => [
    String(index + 1),
    `${secondsToSrt(scene.startSecond)} --> ${secondsToSrt(scene.endSecond)}`,
    scene.caption,
    ""
  ].join("\n")).join("\n");
}

function buildSafetyIssues(input: CampaignInput): HybridCampaign["safetyIssues"] {
  const issues: HybridCampaign["safetyIssues"] = [];
  if (!input.evidence.imageRightsConfirmed) {
    issues.push({
      code: "IMAGE_RIGHTS_NOT_CONFIRMED",
      severity: "BLOCKED",
      message: "쇼츠에 사용할 상품 이미지의 사용권이 확인되지 않았습니다.",
      fix: "공급사 또는 권리자로부터 이미지 사용 허락을 확인한 뒤 다시 생성하세요."
    });
  }
  if (!input.evidence.originConfirmed) {
    issues.push({
      code: "ORIGIN_NOT_CONFIRMED",
      severity: "BLOCKED",
      message: "원산지 정보가 증빙과 대조되지 않았습니다.",
      fix: "원산지 증빙을 확인하고 캠페인 입력의 확인 항목을 체크하세요."
    });
  }
  if (!input.evidence.factsConfirmed) {
    issues.push({
      code: "FACTS_NOT_CONFIRMED",
      severity: "WARNING",
      message: "가격·구성·제조사 등 쇼츠에 사용되는 사실정보의 최종 확인이 필요합니다.",
      fix: "판매페이지와 공급사 자료를 대조한 뒤 사람 검토를 완료하세요."
    });
  }
  if (!input.landingUrl) {
    issues.push({
      code: "LANDING_URL_MISSING",
      severity: "WARNING",
      message: "구매 링크가 없어 쇼츠의 클릭 성과를 측정하기 어렵습니다.",
      fix: "실제 판매페이지가 준비되면 링크를 추가하고 캠페인을 다시 생성하세요."
    });
  }
  if (input.product.compliancePack === "HEALTH_SUPPLEMENT_KR") {
    issues.push({
      code: "HEALTH_CLAIM_HUMAN_REVIEW",
      severity: "WARNING",
      message: "건강기능식품 콘텐츠는 기능성·효능 표현을 사람이 별도로 검토해야 합니다.",
      fix: "인정받은 기능성 범위를 벗어난 질병 예방·치료 표현이 없는지 확인하세요."
    });
  }
  return issues;
}

interface VariantCopy {
  angle: CreativeVariant["angle"];
  name: string;
  hook: string;
  middle: string;
  close: string;
}

function variantCopies(input: CampaignInput): VariantCopy[] {
  const { product, targetAudience } = input;
  const price = formatPrice(product.sellPrice);
  return [
    {
      angle: "PROBLEM_SOLVING",
      name: "문제 해결형",
      hook: `${targetAudience}라면 ${product.title} 고르기 전 이것부터 확인하세요.`,
      middle: `${product.optionSummary}, 원산지 ${product.originDisplay}, ${price}인지 차례로 확인합니다.`,
      close: "과장된 표현보다 실제 구성과 배송 조건을 비교한 뒤 결정하세요."
    },
    {
      angle: "INFORMATION",
      name: "정보 비교형",
      hook: `${product.title}, 이름보다 구성표를 먼저 보세요.`,
      middle: `현재 확인된 정보는 ${product.optionSummary}, 제조사 ${product.manufacturer}, 원산지 ${product.originDisplay}입니다.`,
      close: "가격과 옵션이 내 사용 목적에 맞는지 판매페이지에서 다시 확인하세요."
    },
    {
      angle: "CONVERSION",
      name: "구매 전환형",
      hook: `${product.title}를 찾고 있다면 가격과 구성을 한 번에 확인하세요.`,
      middle: `${product.optionSummary} 구성에 판매가 기준 ${price}입니다.`,
      close: input.landingUrl
        ? "설명란의 판매페이지에서 재고와 최종 조건을 확인하세요."
        : "판매페이지가 연결되면 재고와 최종 조건을 확인하세요."
    }
  ];
}

function sceneCount(duration: CampaignInput["durationSeconds"]): number {
  if (duration === 15) return 4;
  if (duration === 30) return 5;
  return 6;
}

function buildScenes(input: CampaignInput, copy: VariantCopy): CreativeVariant["scenes"] {
  const count = sceneCount(input.durationSeconds);
  const duration = input.durationSeconds;
  const step = duration / count;
  const facts = [
    copy.hook,
    toneLead[input.tone],
    `구성: ${input.product.optionSummary}`,
    `원산지: ${input.product.originDisplay}`,
    `판매가: ${formatPrice(input.product.sellPrice)}`,
    copy.close
  ];
  const visualDirections = [
    "대표 상품 이미지를 크게 배치하고 핵심 후킹 자막을 표시",
    "상품 전체 모습과 포장 정보를 천천히 확대",
    "구성·옵션 텍스트를 이미지 위에 명확하게 표시",
    "원산지·제조사 정보를 증빙 확인 표시와 함께 노출",
    "가격·구매 전 확인사항을 카드 형태로 표시",
    "상품 이미지와 구매 전 최종 확인 CTA를 표시"
  ];
  return Array.from({ length: count }, (_, index) => ({
    order: index + 1,
    startSecond: Number((step * index).toFixed(2)),
    endSecond: Number((step * (index + 1)).toFixed(2)),
    visualDirection: visualDirections[index] ?? visualDirections.at(-1)!,
    caption: facts[index] ?? copy.middle,
    narration: index === 0 ? copy.hook : index === count - 1 ? copy.close : facts[index] ?? copy.middle
  }));
}

function buildHashtags(input: CampaignInput): string[] {
  const titleTokens = input.product.title.split(/\s+/).map(cleanToken).filter(Boolean).slice(0, 4);
  return unique([
    ...titleTokens.map((token) => `#${token}`),
    "#쇼핑쇼츠",
    "#구매가이드",
    "#상품비교",
    input.product.compliancePack === "AGRI_KR" ? "#농산물" : "#온라인쇼핑"
  ]).slice(0, 10);
}

function buildCreative(input: CampaignInput, copy: VariantCopy, campaignId: string): CreativeVariant {
  const scenes = buildScenes(input, copy);
  const disclosureText = disclosureByType[input.disclosureType];
  const descriptionParts = [
    disclosureText,
    copy.middle,
    `상품: ${input.product.title}`,
    `구성: ${input.product.optionSummary}`,
    `원산지: ${input.product.originDisplay}`,
    `가격: ${formatPrice(input.product.sellPrice)}`,
    input.landingUrl ? `구매페이지: ${input.landingUrl}` : "구매페이지는 최종 게시 전에 연결하세요.",
    "최종 가격·재고·배송조건은 판매페이지에서 다시 확인하세요."
  ];
  return {
    id: `${campaignId}-${copy.angle.toLowerCase()}`,
    angle: copy.angle,
    name: copy.name,
    hook: copy.hook,
    title: `${input.product.title} 구매 전 확인 | ${copy.name}`,
    description: descriptionParts.join("\n"),
    pinnedComment: input.landingUrl
      ? `구매 전 구성·가격·배송조건을 다시 확인하세요. ${input.landingUrl}`
      : "구매 링크가 연결되면 이 댓글을 업데이트하세요.",
    hashtags: buildHashtags(input),
    disclosureText,
    scenes,
    subtitleSrt: buildSrt(scenes),
    renderManifest: {
      width: 720,
      height: 1280,
      aspectRatio: "9:16",
      durationSeconds: input.durationSeconds,
      requiresHumanReview: true,
      outputPreference: "MP4_IF_SUPPORTED"
    }
  };
}

export function generateCampaign(
  rawInput: CampaignInput,
  meta: { id: string; now: string }
): HybridCampaign {
  const input = campaignInputSchema.parse(rawInput);
  const creatives = variantCopies(input).map((copy) => buildCreative(input, copy, meta.id));
  const safetyIssues = buildSafetyIssues(input);
  const campaign: HybridCampaign = {
    schemaVersion: "1.0.0",
    id: meta.id,
    createdAt: meta.now,
    updatedAt: meta.now,
    approvalStatus: "AWAITING_APPROVAL",
    input,
    offer: {
      channelTitle: [input.product.originDisplay, input.product.title, input.product.optionSummary]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500),
      sellPrice: input.product.sellPrice,
      listPrice: input.product.listPrice,
      landingUrl: input.landingUrl,
      callToAction: input.landingUrl
        ? "판매페이지에서 최종 가격·재고·배송조건 확인"
        : "판매페이지 연결 후 최종 조건 확인"
    },
    creatives,
    safetyIssues,
    performanceSnapshots: [],
    insight: {
      type: "NO_DATA",
      message: "아직 성과 데이터가 없습니다.",
      nextAction: "쇼츠를 게시한 뒤 조회·클릭·주문·매출을 기록하세요."
    }
  };
  return hybridCampaignSchema.parse(campaign);
}

export function approveCampaign(campaign: HybridCampaign, now: string): HybridCampaign {
  const parsed = hybridCampaignSchema.parse(campaign);
  const blocked = parsed.safetyIssues.filter((issue) => issue.severity === "BLOCKED");
  if (blocked.length) {
    throw new Error(`차단 항목 ${blocked.length}개를 해결하기 전에는 캠페인을 승인할 수 없습니다.`);
  }
  return hybridCampaignSchema.parse({
    ...parsed,
    approvalStatus: "APPROVED",
    updatedAt: now
  });
}

export function buildPerformanceSnapshot(input: {
  id: string;
  recordedAt: string;
  channel: PerformanceSnapshot["channel"];
  creativeId: string;
  views: number;
  clicks: number;
  orders: number;
  revenue: number;
  adSpend: number;
  note?: string;
}): PerformanceSnapshot {
  const clickThroughRateBp = input.views > 0 ? Math.round((input.clicks / input.views) * 10_000) : 0;
  const orderConversionRateBp = input.clicks > 0 ? Math.round((input.orders / input.clicks) * 10_000) : 0;
  const returnOnAdSpendBp = input.adSpend > 0
    ? Math.round((input.revenue / input.adSpend) * 10_000)
    : undefined;
  return performanceSnapshotSchema.parse({
    ...input,
    clickThroughRateBp,
    orderConversionRateBp,
    ...(returnOnAdSpendBp === undefined ? {} : { returnOnAdSpendBp })
  });
}

function buildInsight(snapshots: PerformanceSnapshot[]): HybridCampaign["insight"] {
  if (!snapshots.length) {
    return {
      type: "NO_DATA",
      message: "아직 성과 데이터가 없습니다.",
      nextAction: "쇼츠 게시 후 최소 조회 100회 이상에서 첫 비교를 시작하세요."
    };
  }
  const totalViews = snapshots.reduce((sum, item) => sum + item.views, 0);
  const totalClicks = snapshots.reduce((sum, item) => sum + item.clicks, 0);
  const totalOrders = snapshots.reduce((sum, item) => sum + item.orders, 0);
  const ctrBp = totalViews > 0 ? Math.round((totalClicks / totalViews) * 10_000) : 0;
  const conversionBp = totalClicks > 0 ? Math.round((totalOrders / totalClicks) * 10_000) : 0;
  if (totalViews >= 100 && ctrBp < 100) {
    return {
      type: "LOW_CTR",
      message: `조회 대비 클릭률이 ${(ctrBp / 100).toFixed(2)}%로 낮습니다.`,
      nextAction: "첫 2초 후킹과 구매 이유를 더 구체적으로 바꾼 새 변형을 만드세요."
    };
  }
  if (totalClicks >= 20 && conversionBp < 200) {
    return {
      type: "LOW_CONVERSION",
      message: `클릭 대비 주문전환율이 ${(conversionBp / 100).toFixed(2)}%로 낮습니다.`,
      nextAction: "판매가·배송비·옵션·상세페이지 신뢰요소를 점검하세요."
    };
  }
  if (totalOrders > 0 && ctrBp >= 100) {
    return {
      type: "POSITIVE",
      message: "클릭과 주문이 함께 발생하고 있습니다.",
      nextAction: "성과가 가장 좋은 크리에이티브 각도를 유지하고 후킹만 추가 실험하세요."
    };
  }
  return {
    type: "MIXED",
    message: "초기 데이터가 쌓이고 있으나 뚜렷한 결론을 내리기에는 표본이 적습니다.",
    nextAction: "같은 상품에서 3개 크리에이티브를 비슷한 조건으로 비교하세요."
  };
}

export function appendPerformance(
  campaign: HybridCampaign,
  snapshot: PerformanceSnapshot,
  now: string
): HybridCampaign {
  const parsed = hybridCampaignSchema.parse(campaign);
  if (!parsed.creatives.some((creative) => creative.id === snapshot.creativeId)) {
    throw new Error("캠페인에 속하지 않은 크리에이티브입니다.");
  }
  if (!parsed.input.channels.includes(snapshot.channel)) {
    throw new Error("캠페인 대상 채널이 아닙니다.");
  }
  const performanceSnapshots = [...parsed.performanceSnapshots, performanceSnapshotSchema.parse(snapshot)];
  return hybridCampaignSchema.parse({
    ...parsed,
    updatedAt: now,
    performanceSnapshots,
    insight: buildInsight(performanceSnapshots)
  });
}
