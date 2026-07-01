import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const packageRoots = ["packages/core/src", "packages/agent/src"];
const files = (await Promise.all(packageRoots.map(walk))).flat();
const forbidden = [
  "node:http",
  "node:https",
  "node:net",
  "node:dns",
  "node:sqlite"
];
const violations: string[] = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const token of forbidden) {
    if (content.includes(token)) violations.push(`${file}: ${token}`);
  }
  if (/\bfetch\s*\(/.test(content)) violations.push(`${file}: fetch()`);
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log(`경계 검사 통과: core+agent ${files.length}개 파일`);
