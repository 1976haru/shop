import { readFile } from "node:fs/promises";
import { parseCsv, normalizeHeaders } from "../../../packages/core/src/csv.ts";
import {
  opportunityCandidateInputSchema,
  type AgentRunRequest,
  type AgentSourceState,
  type OpportunityCandidateInput
} from "../../../packages/agent/src/schema.ts";
import type { AgentSourceBundle } from "../../../packages/agent/src/orchestrator.ts";
import { projectRoot } from "./context.ts";

interface FixtureFile {
  generatedAt: string;
  notice: string;
  themes: Record<string, unknown[]>;
}

interface SourceCapability {
  id: string;
  enabled: boolean;
  reason: string;
}

const externalAllowed = process.env.ALLOW_EXTERNAL_RESEARCH === "true";

function nowIso(): string {
  return new Date().toISOString();
}

function integer(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const normalized = raw.replaceAll(",", "").trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : undefined;
}

function keywordsFromTitle(title: string): string[] {
  const words = title
    .replace(/[^0-9A-Za-z가-힣\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  return [...new Set(words)].slice(0, 8).length ? [...new Set(words)].slice(0, 8) : [title];
}

function supplierCandidates(request: AgentRunRequest): OpportunityCandidateInput[] {
  if (!request.supplierCsvText?.trim()) return [];
  const document = parseCsv(request.supplierCsvText);
  return document.rows.flatMap((raw, index) => {
    const row = normalizeHeaders(raw);
    const name = row.product_title?.trim();
    const supplierSku = row.supplier_sku?.trim();
    if (!name || !supplierSku) return [];
    const candidate = {
      id: `supplier-${supplierSku}-${index + 2}`,
      theme: request.theme,
      name,
      keywords: keywordsFromTitle(name),
      supplierSku,
      ...(integer(row.cost) !== undefined ? { cost: integer(row.cost) } : {}),
      supplierShipFee: integer(row.supplier_ship_fee) ?? 0,
      fixedCost: integer(row.fixed_cost) ?? 0,
      ...(integer(row.stock) !== undefined ? { stock: integer(row.stock) } : {}),
      demandTrendScore: 50,
      seasonalityScore: request.theme === "AGRI_KR" ? 60 : 50,
      competitionAttractivenessScore: 50,
      priceStabilityScore: 50,
      supplyStabilityScore: 60,
      operationEaseScore: request.theme === "AGRI_KR" ? 55 : 70,
      shippingRiskScore: request.theme === "AGRI_KR" ? 50 : 25,
      complianceGate: "WARNING" as const,
      complianceReasons: ["공급사 원본 정보와 법정 표시사항을 사람이 확인해야 합니다."],
      evidence: [{
        source: "SUPPLIER_CSV" as const,
        label: `공급사 CSV ${index + 2}행`,
        capturedAt: nowIso(),
        freshness: "LIVE" as const,
        value: supplierSku
      }]
    };
    return [opportunityCandidateInputSchema.parse(candidate)];
  });
}

async function fixtureCandidates(request: AgentRunRequest): Promise<OpportunityCandidateInput[]> {
  const fixture = JSON.parse(
    await readFile(`${projectRoot}/fixtures/agent/theme-opportunities.json`, "utf8")
  ) as FixtureFile;
  return (fixture.themes[request.theme] ?? []).map((candidate) =>
    opportunityCandidateInputSchema.parse(candidate)
  );
}

function sourceState(
  source: AgentSourceState["source"],
  status: AgentSourceState["status"],
  message: string,
  recordCount = 0
): AgentSourceState {
  return {
    source,
    status,
    message,
    recordCount,
    ...(status === "USED" ? { collectedAt: nowIso() } : {})
  };
}

function allObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(allObjects);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(allObjects)];
}

function textValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function priceValue(value: unknown): number | undefined {
  const normalized = textValue(value).replaceAll(",", "");
  if (!/^\d+$/.test(normalized)) return undefined;
  const result = Number(normalized);
  return Number.isSafeInteger(result) && result > 0 ? result : undefined;
}

async function collectKamis(): Promise<{
  candidates: OpportunityCandidateInput[];
  state: AgentSourceState;
}> {
  if (!externalAllowed) {
    return {
      candidates: [],
      state: sourceState("KAMIS", "UNAVAILABLE", "ALLOW_EXTERNAL_RESEARCH=true 설정이 필요합니다.")
    };
  }
  const key = process.env.KAMIS_CERT_KEY;
  const id = process.env.KAMIS_CERT_ID;
  if (!key || !id) {
    return {
      candidates: [],
      state: sourceState("KAMIS", "UNAVAILABLE", "KAMIS_CERT_KEY와 KAMIS_CERT_ID가 필요합니다.")
    };
  }
  try {
    const url = new URL("https://www.kamis.or.kr/service/price/xml.do");
    url.searchParams.set("action", "dailySalesList");
    url.searchParams.set("p_cert_key", key);
    url.searchParams.set("p_cert_id", id);
    url.searchParams.set("p_returntype", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as unknown;
    const rows = allObjects(body).filter((record) =>
      Boolean(textValue(record.productName) || textValue(record.item_name))
    );
    const capturedAt = nowIso();
    const candidates = rows.flatMap((record, index) => {
      const name = textValue(record.item_name) || textValue(record.productName);
      const category = textValue(record.category_name);
      if (!name || category.includes("축산") || category.includes("수산")) return [];
      const marketPrice = priceValue(record.dpr1);
      const change = Number.parseFloat(textValue(record.value).replace("%", ""));
      const stable = Number.isFinite(change)
        ? Math.max(20, Math.min(100, 100 - Math.abs(change) * 4))
        : 55;
      const candidate = opportunityCandidateInputSchema.parse({
        id: `kamis-${textValue(record.productno) || index}`,
        theme: "AGRI_KR",
        name,
        keywords: keywordsFromTitle(name),
        ...(marketPrice !== undefined ? { marketPrice } : {}),
        demandTrendScore: 50,
        seasonalityScore: 55,
        competitionAttractivenessScore: 50,
        priceStabilityScore: stable,
        supplyStabilityScore: stable,
        operationEaseScore: category.includes("과일") || category.includes("채소") ? 55 : 70,
        shippingRiskScore: category.includes("과일") || category.includes("채소") ? 58 : 35,
        complianceGate: "WARNING",
        complianceReasons: ["KAMIS 가격은 시장 참고값이며 실제 온라인 판매가와 공급가를 별도로 확인해야 합니다."],
        evidence: [{
          source: "KAMIS",
          label: `${category || "농산물"} 최근 가격`,
          capturedAt,
          freshness: "LIVE",
          reference: "KAMIS dailySalesList",
          ...(marketPrice !== undefined ? { value: marketPrice } : {})
        }]
      });
      return [candidate];
    }).slice(0, 100);
    return {
      candidates,
      state: sourceState("KAMIS", "USED", "KAMIS 최근 도·소매 가격을 수집했습니다.", candidates.length)
    };
  } catch (error) {
    return {
      candidates: [],
      state: sourceState(
        "KAMIS",
        "FAILED",
        `KAMIS 수집 실패: ${error instanceof Error ? error.message : String(error)}`
      )
    };
  }
}

function mergeByKeyword(
  seeds: OpportunityCandidateInput[],
  signals: OpportunityCandidateInput[]
): OpportunityCandidateInput[] {
  if (!seeds.length) return signals;
  return seeds.map((seed) => {
    const normalized = `${seed.name} ${seed.keywords.join(" ")}`.toLowerCase();
    const match = signals.find((signal) =>
      signal.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
    );
    if (!match) return seed;
    return opportunityCandidateInputSchema.parse({
      ...seed,
      marketPrice: seed.marketPrice ?? match.marketPrice,
      priceStabilityScore: Math.round((seed.priceStabilityScore + match.priceStabilityScore) / 2),
      supplyStabilityScore: Math.round((seed.supplyStabilityScore + match.supplyStabilityScore) / 2),
      evidence: [...seed.evidence, ...match.evidence]
    });
  });
}

async function enrichNaverTrend(
  candidates: OpportunityCandidateInput[]
): Promise<{ candidates: OpportunityCandidateInput[]; state: AgentSourceState }> {
  if (!externalAllowed) {
    return { candidates, state: sourceState("NAVER_TREND", "UNAVAILABLE", "외부 연구 모드가 꺼져 있습니다.") };
  }
  const endpoint = process.env.NAVER_TREND_ENDPOINT;
  const clientId = process.env.NAVER_TREND_CLIENT_ID;
  const clientSecret = process.env.NAVER_TREND_CLIENT_SECRET;
  if (!endpoint || !clientId || !clientSecret) {
    return {
      candidates,
      state: sourceState(
        "NAVER_TREND",
        "UNAVAILABLE",
        "NAVER API HUB 또는 기존 DataLab의 endpoint·client ID·secret 설정이 필요합니다."
      )
    };
  }
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);
    const body = {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      timeUnit: "week",
      keywordGroups: candidates.slice(0, 5).map((candidate) => ({
        groupName: candidate.id,
        keywords: candidate.keywords.slice(0, 5)
      }))
    };
    const idHeader = process.env.NAVER_TREND_ID_HEADER ?? "X-Naver-Client-Id";
    const secretHeader = process.env.NAVER_TREND_SECRET_HEADER ?? "X-Naver-Client-Secret";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [idHeader]: clientId,
        [secretHeader]: clientSecret
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { results?: Array<{ title?: string; data?: Array<{ ratio?: number }> }> };
    const byId = new Map((data.results ?? []).map((result) => [result.title ?? "", result]));
    const capturedAt = nowIso();
    const enriched = candidates.map((candidate) => {
      const points = byId.get(candidate.id)?.data ?? [];
      const first = points[0]?.ratio;
      const last = points.at(-1)?.ratio;
      if (first === undefined || last === undefined) return candidate;
      const demandTrendScore = Math.max(0, Math.min(100, Math.round(50 + (last - first) / 2)));
      return opportunityCandidateInputSchema.parse({
        ...candidate,
        demandTrendScore,
        evidence: [...candidate.evidence, {
          source: "NAVER_TREND",
          label: "최근 4주 검색 관심도 변화",
          capturedAt,
          freshness: "LIVE",
          reference: endpoint,
          value: Math.round((last - first) * 10) / 10
        }]
      });
    });
    return {
      candidates: enriched,
      state: sourceState("NAVER_TREND", "USED", "네이버 검색 관심도 신호를 반영했습니다.", byId.size)
    };
  } catch (error) {
    return {
      candidates,
      state: sourceState(
        "NAVER_TREND",
        "FAILED",
        `네이버 트렌드 수집 실패: ${error instanceof Error ? error.message : String(error)}`
      )
    };
  }
}

async function enrichFoodSafety(
  candidates: OpportunityCandidateInput[]
): Promise<{ candidates: OpportunityCandidateInput[]; state: AgentSourceState }> {
  if (!externalAllowed) {
    return { candidates, state: sourceState("FOOD_SAFETY_KOREA", "UNAVAILABLE", "외부 연구 모드가 꺼져 있습니다.") };
  }
  const key = process.env.FOOD_SAFETY_KEY;
  const serviceId = process.env.FOOD_SAFETY_SERVICE_ID;
  const queryField = process.env.FOOD_SAFETY_QUERY_FIELD;
  if (!key || !serviceId || !queryField) {
    return {
      candidates,
      state: sourceState(
        "FOOD_SAFETY_KOREA",
        "UNAVAILABLE",
        "FOOD_SAFETY_KEY, SERVICE_ID, QUERY_FIELD 설정이 필요합니다."
      )
    };
  }
  let records = 0;
  const capturedAt = nowIso();
  const enriched: OpportunityCandidateInput[] = [];
  try {
    for (const candidate of candidates.slice(0, 10)) {
      const keyword = candidate.keywords[0] ?? candidate.name;
      const suffix = `${encodeURIComponent(queryField)}=${encodeURIComponent(keyword)}`;
      const url = `https://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(key)}/${encodeURIComponent(serviceId)}/json/1/100/${suffix}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as Record<string, unknown>;
      const rows = allObjects(body).filter((record) => Object.keys(record).some((field) => field.toLowerCase() === "prdlst_nm" || field.toLowerCase() === "prdlstnm"));
      records += rows.length;
      const missingForSupplement = candidate.theme === "HEALTH_SUPPLEMENT_KR" && rows.length === 0;
      enriched.push(opportunityCandidateInputSchema.parse({
        ...candidate,
        complianceGate: missingForSupplement ? "BLOCKED" : candidate.complianceGate,
        complianceReasons: [
          ...candidate.complianceReasons,
          rows.length
            ? `식품안전나라 관련 레코드 ${rows.length}건을 찾았습니다. 제품 식별자를 사람이 대조해야 합니다.`
            : "식품안전나라에서 관련 레코드를 찾지 못했습니다. 서비스·검색필드 설정과 제품명을 확인하세요."
        ],
        evidence: [...candidate.evidence, {
          source: "FOOD_SAFETY_KOREA",
          label: "식품안전나라 검색 결과",
          capturedAt,
          freshness: "LIVE",
          reference: `${serviceId}:${queryField}`,
          value: rows.length
        }]
      }));
    }
    enriched.push(...candidates.slice(10));
    return {
      candidates: enriched,
      state: sourceState("FOOD_SAFETY_KOREA", "USED", "식품안전나라 제품·신고 근거를 조회했습니다.", records)
    };
  } catch (error) {
    return {
      candidates,
      state: sourceState(
        "FOOD_SAFETY_KOREA",
        "FAILED",
        `식품안전나라 수집 실패: ${error instanceof Error ? error.message : String(error)}`
      )
    };
  }
}

export function getAgentCapabilities(): {
  externalResearchAllowed: boolean;
  capabilities: SourceCapability[];
} {
  return {
    externalResearchAllowed: externalAllowed,
    capabilities: [
      { id: "FIXTURE", enabled: true, reason: "항상 사용 가능한 안전한 데모 데이터" },
      {
        id: "SUPPLIER_CSV",
        enabled: true,
        reason: "사용자가 업로드한 공급사 상품정보를 후보로 사용"
      },
      {
        id: "KAMIS",
        enabled: externalAllowed && Boolean(process.env.KAMIS_CERT_KEY && process.env.KAMIS_CERT_ID),
        reason: "KAMIS 인증키와 요청자 ID가 필요"
      },
      {
        id: "NAVER_TREND",
        enabled: externalAllowed && Boolean(
          process.env.NAVER_TREND_ENDPOINT &&
          process.env.NAVER_TREND_CLIENT_ID &&
          process.env.NAVER_TREND_CLIENT_SECRET
        ),
        reason: "2026년 API HUB 이관을 고려해 endpoint와 인증 헤더를 환경변수로 설정"
      },
      {
        id: "FOOD_SAFETY_KOREA",
        enabled: externalAllowed && Boolean(
          process.env.FOOD_SAFETY_KEY &&
          process.env.FOOD_SAFETY_SERVICE_ID &&
          process.env.FOOD_SAFETY_QUERY_FIELD
        ),
        reason: "식품안전나라 인증키·서비스 ID·검색 필드가 필요"
      }
    ]
  };
}

export async function collectAgentSources(request: AgentRunRequest): Promise<AgentSourceBundle> {
  const supplier = supplierCandidates(request);
  const fixture = await fixtureCandidates(request);
  const sources: AgentSourceState[] = [];
  const warnings: string[] = [];
  let candidates: OpportunityCandidateInput[] = supplier.length ? supplier : fixture;

  if (supplier.length) {
    sources.push(sourceState("SUPPLIER_CSV", "USED", "공급사 CSV를 상품 후보로 사용했습니다.", supplier.length));
  } else {
    sources.push(sourceState("SUPPLIER_CSV", "SKIPPED", "공급사 CSV가 없어 기본 후보를 사용했습니다."));
  }

  if (request.mode === "DEMO") {
    if (supplier.length) candidates = mergeByKeyword(supplier, fixture);
    sources.push(sourceState("FIXTURE", "USED", "테마별 데모 신호를 사용했습니다.", fixture.length));
    sources.push(sourceState("KAMIS", "SKIPPED", "데모 모드에서는 실시간 KAMIS를 호출하지 않습니다."));
    sources.push(sourceState("NAVER_TREND", "SKIPPED", "데모 모드에서는 네이버 API를 호출하지 않습니다."));
    sources.push(sourceState("FOOD_SAFETY_KOREA", "SKIPPED", "데모 모드에서는 식품안전나라를 호출하지 않습니다."));
    warnings.push("데모 점수는 기능 체험용이며 실제 유행·판매량을 뜻하지 않습니다.");
    return { candidates, sources, warnings };
  }

  sources.push(sourceState("FIXTURE", supplier.length ? "SKIPPED" : "USED", supplier.length
    ? "실시간 모드에서 공급사 후보를 우선했습니다."
    : "공급사 후보가 없어 fixture를 후보 seed로 사용했습니다.", supplier.length ? 0 : fixture.length));

  if (request.theme === "AGRI_KR") {
    const kamis = await collectKamis();
    sources.push(kamis.state);
    candidates = mergeByKeyword(candidates, kamis.candidates);
  } else {
    sources.push(sourceState("KAMIS", "SKIPPED", "농산물 테마가 아니므로 KAMIS를 건너뜁니다."));
  }

  const naver = await enrichNaverTrend(candidates);
  candidates = naver.candidates;
  sources.push(naver.state);

  if (request.theme !== "AGRI_KR") {
    const foodSafety = await enrichFoodSafety(candidates);
    candidates = foodSafety.candidates;
    sources.push(foodSafety.state);
  } else {
    sources.push(sourceState("FOOD_SAFETY_KOREA", "SKIPPED", "농산물 1차 분석에서는 식품안전나라를 건너뜁니다."));
  }

  if (!externalAllowed) {
    warnings.push("실시간 수집을 사용하려면 ALLOW_EXTERNAL_RESEARCH=true와 각 공식 API 키가 필요합니다.");
  }
  return { candidates, sources, warnings };
}
