import type { DiagnosisReport } from "./types.ts";

export interface RunDiff {
  baseRunId: string; targetRunId: string; newItems: string[]; removedItems: string[];
  changedItems: Array<{ internalCode: string; verdictBefore: string; verdictAfter: string;
    priceBefore?: number; priceAfter?: number; newIssues: string[]; resolvedIssues: string[]; }>;
  summary: { newlyBlocked: number; newlyReady: number; priceChanged: number; added: number; removed: number; };
}

export function diffReports(base: DiagnosisReport, target: DiagnosisReport): RunDiff {
  const before = new Map(base.items.filter((item) => item.internalCode).map((item) => [item.internalCode!, item]));
  const after = new Map(target.items.filter((item) => item.internalCode).map((item) => [item.internalCode!, item]));
  const newItems = [...after.keys()].filter((key) => !before.has(key));
  const removedItems = [...before.keys()].filter((key) => !after.has(key));
  const changedItems: RunDiff["changedItems"] = [];
  for (const [key, current] of after) {
    const previous = before.get(key);
    if (!previous) continue;
    const previousIssues = new Set(previous.issues.map((issue) => issue.ruleId));
    const currentIssues = new Set(current.issues.map((issue) => issue.ruleId));
    const changed = previous.verdict !== current.verdict || previous.price?.sellPrice !== current.price?.sellPrice ||
      [...previousIssues].some((value) => !currentIssues.has(value)) || [...currentIssues].some((value) => !previousIssues.has(value));
    if (changed) changedItems.push({ internalCode: key, verdictBefore: previous.verdict, verdictAfter: current.verdict,
      priceBefore: previous.price?.sellPrice, priceAfter: current.price?.sellPrice,
      newIssues: [...currentIssues].filter((value) => !previousIssues.has(value)),
      resolvedIssues: [...previousIssues].filter((value) => !currentIssues.has(value)) });
  }
  return { baseRunId: base.run.id, targetRunId: target.run.id, newItems, removedItems, changedItems,
    summary: { newlyBlocked: changedItems.filter((item) => item.verdictBefore !== "BLOCKED" && item.verdictAfter === "BLOCKED").length,
      newlyReady: changedItems.filter((item) => item.verdictBefore === "BLOCKED" && item.verdictAfter !== "BLOCKED").length,
      priceChanged: changedItems.filter((item) => item.priceBefore !== item.priceAfter).length,
      added: newItems.length, removed: removedItems.length } };
}
