import type { NormalizedAttributeValue } from "./types.ts";

const unitAliases: Record<string, string> = {
  kg: "kg", KG: "kg", 킬로: "kg", 킬로그램: "kg",
  g: "g", G: "g", 그램: "g",
  ml: "ml", mL: "ml", ML: "ml", 밀리리터: "ml",
  l: "l", L: "l", 리터: "l",
  개: "개", ea: "개", EA: "개"
};

export function normalizeAttributeValue(raw: string): NormalizedAttributeValue {
  const value = raw.trim();
  if (!value) return { raw, normalizedText: "", parseStatus: "FAILED" };
  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)\s*([^0-9\s]+)$/u);
  if (!match) return { raw, normalizedText: value, parseStatus: "TEXT_ONLY" };
  const numericValue = Number(match[1]);
  const unitRaw = match[2];
  const unitCanonical = unitAliases[unitRaw];
  if (!unitCanonical) return { raw, numericValue, unitRaw, normalizedText: value, parseStatus: "AMBIGUOUS" };
  let normalizedNumber = numericValue;
  let normalizedUnit = unitCanonical;
  if (unitCanonical === "g" && numericValue >= 1000 && numericValue % 1000 === 0) {
    normalizedNumber = numericValue / 1000;
    normalizedUnit = "kg";
  }
  if (unitCanonical === "ml" && numericValue >= 1000 && numericValue % 1000 === 0) {
    normalizedNumber = numericValue / 1000;
    normalizedUnit = "l";
  }
  return { raw, numericValue: normalizedNumber, unitRaw, unitCanonical: normalizedUnit,
    normalizedText: `${normalizedNumber}${normalizedUnit}`, parseStatus: "PARSED" };
}
