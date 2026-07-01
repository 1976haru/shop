import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  appendPerformance,
  approveCampaign,
  buildPerformanceSnapshot,
  generateCampaign,
  type CampaignInput,
  type ShortChannel
} from "../../../packages/campaign/src/index.ts";
import { store } from "./context.ts";
import { readJsonBody, sendJson } from "./http-utils.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function compactString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

export async function handleCampaignApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const path = url.pathname;

  if (path === "/api/campaigns" && req.method === "GET") {
    sendJson(res, 200, { campaigns: store.listCampaigns() });
    return true;
  }

  if (path === "/api/campaigns/from-run" && req.method === "POST") {
    const input = await readJsonBody(req);
    const runId = String(input.runId ?? "");
    const itemIndex = Number(input.itemIndex);
    const found = store.get(runId);
    if (!found) throw new Error("캠페인 원본 진단 이력을 찾을 수 없습니다.");
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= found.report.items.length) {
      throw new Error("캠페인으로 만들 상품을 다시 선택하세요.");
    }

    const item = found.report.items[itemIndex];
    if (item.verdict === "BLOCKED" || !item.canonical) {
      throw new Error("차단된 상품은 문제를 수정하고 재진단한 뒤 캠페인으로 만들 수 있습니다.");
    }

    const primarySku = item.canonical.skus[0];
    const optionSummary = primarySku.options
      .map((option) => `${option.name} ${option.value}`)
      .join(" · ");
    const settings = input.settings ?? {};
    const landingUrl = compactString(settings.landingUrl);
    const channels = asStringArray(settings.channels) as ShortChannel[];

    const campaignInput: CampaignInput = {
      campaignName: String(settings.campaignName ?? `${item.canonical.titleStandard} 쇼핑쇼츠 캠페인`),
      objective: settings.objective ?? "CONVERSION",
      targetAudience: String(settings.targetAudience ?? "온라인에서 상품 정보를 비교하는 구매자"),
      tone: settings.tone ?? "TRUSTWORTHY",
      durationSeconds: Number(settings.durationSeconds ?? 30) as 15 | 30 | 45,
      channels: channels.length ? channels : ["YOUTUBE_SHORTS"],
      disclosureType: settings.disclosureType ?? "DIRECT_SALE",
      ...(landingUrl ? { landingUrl } : {}),
      forbiddenClaims: asStringArray(settings.forbiddenClaims),
      evidence: {
        originConfirmed: Boolean(settings.evidence?.originConfirmed),
        imageRightsConfirmed: Boolean(settings.evidence?.imageRightsConfirmed),
        factsConfirmed: Boolean(settings.evidence?.factsConfirmed)
      },
      product: {
        sourceRunId: runId,
        sourceItemIndex: itemIndex,
        internalCode: item.canonical.internalCode,
        supplierSku: item.canonical.supplierSku,
        title: item.canonical.titleStandard,
        ...(item.canonical.brand.name ? { brand: item.canonical.brand.name } : {}),
        manufacturer: item.canonical.manufacturer,
        originDisplay: item.canonical.originDisplay,
        optionSummary,
        ...(item.price ? { sellPrice: item.price.sellPrice, listPrice: item.price.listPrice } : {}),
        stock: primarySku.stock,
        categoryCode: item.canonical.internalCategoryCode,
        compliancePack: item.canonical.compliancePack
      }
    };

    const campaign = generateCampaign(campaignInput, {
      id: `CMP-${randomUUID()}`,
      now: nowIso()
    });
    store.saveCampaign(campaign);
    sendJson(res, 201, campaign);
    return true;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "campaigns" || !segments[2]) {
    return false;
  }

  const campaign = store.getCampaign(segments[2]);
  if (!campaign) {
    sendJson(res, 404, {
      error: { code: "CAMPAIGN_NOT_FOUND", message: "쇼핑쇼츠 캠페인을 찾을 수 없습니다." }
    });
    return true;
  }

  if (segments.length === 3 && req.method === "GET") {
    sendJson(res, 200, campaign);
    return true;
  }

  if (segments.length === 3 && req.method === "DELETE") {
    store.deleteCampaign(campaign.id);
    sendJson(res, 200, { deleted: true });
    return true;
  }

  if (segments[3] === "approve" && req.method === "POST") {
    const approved = approveCampaign(campaign, nowIso());
    store.saveCampaign(approved);
    sendJson(res, 200, approved);
    return true;
  }

  if (segments[3] === "performance" && req.method === "POST") {
    const input = await readJsonBody(req);
    const snapshot = buildPerformanceSnapshot({
      id: `PERF-${randomUUID()}`,
      recordedAt: nowIso(),
      channel: input.channel,
      creativeId: String(input.creativeId ?? ""),
      views: Number(input.views ?? 0),
      clicks: Number(input.clicks ?? 0),
      orders: Number(input.orders ?? 0),
      revenue: Number(input.revenue ?? 0),
      adSpend: Number(input.adSpend ?? 0),
      ...(compactString(input.note) ? { note: compactString(input.note) } : {})
    });
    const updated = appendPerformance(campaign, snapshot, nowIso());
    store.saveCampaign(updated);
    sendJson(res, 201, updated);
    return true;
  }

  return false;
}
