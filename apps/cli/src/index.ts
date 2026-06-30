import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { decodeCsv, diagnoseCsv, fixedClock } from "../../../packages/core/src/index.ts";
import type { MetadataSnapshot, PricePolicy } from "../../../packages/core/src/types.ts";

function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const optionValues = [option("--metadata"), option("--policy"), option("--out")];
const positional = process.argv.slice(2).find((value) => !value.startsWith("--") && !optionValues.includes(value));
if (!positional) {
  console.error("사용법: npm run diagnose -- <csv> [--metadata file] [--policy file] [--out file]");
  process.exit(1);
}
const metadataPath = option("--metadata", "fixtures/coupang-meta/agri.fixture.json")!;
const policyPath = option("--policy", "fixtures/policies/local-default.json")!;
const outputPath = option("--out", "tmp/report.json")!;

try {
  const [csvBytes, metadataRaw, policyRaw] = await Promise.all([
    readFile(resolve(positional)), readFile(resolve(metadataPath), "utf8"), readFile(resolve(policyPath), "utf8")
  ]);
  const decoded = decodeCsv(csvBytes);
  const report = diagnoseCsv({ csvText: decoded.text, filename: positional,
    metadata: JSON.parse(metadataRaw) as MetadataSnapshot, pricePolicy: JSON.parse(policyRaw) as PricePolicy,
    clock: fixedClock("2026-06-30T12:00:00Z") });
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(resolve(outputPath), JSON.stringify(report, null, 2));
  console.log(`진단 완료: ${report.summary.processed}건 / PASS ${report.summary.pass} / WARNING ${report.summary.warning} / BLOCKED ${report.summary.blocked}`);
  console.log(`인코딩: ${decoded.encoding}`);
  console.log(`결과: ${resolve(outputPath)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
