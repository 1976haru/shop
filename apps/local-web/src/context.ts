import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MetadataSnapshot, PricePolicy } from "../../../packages/core/src/types.ts";
import { RunStore } from "./store.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
export const projectRoot = resolve(here, "../../..");
export const publicRoot = resolve(here, "../public");
const dataRoot = resolve(process.env.DATA_ROOT ?? `${projectRoot}/data`);

export const store = new RunStore(`${dataRoot}/runs.sqlite`);
export const metadata = JSON.parse(
  await readFile(`${projectRoot}/fixtures/coupang-meta/agri.fixture.json`, "utf8")
) as MetadataSnapshot;
export const defaultPolicy = JSON.parse(
  await readFile(`${projectRoot}/fixtures/policies/local-default.json`, "utf8")
) as PricePolicy;
export const demoCsv = await readFile(`${projectRoot}/fixtures/demo/dirty-sample.csv`, "utf8");
