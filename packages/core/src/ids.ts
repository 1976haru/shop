import { createHash, randomUUID } from "node:crypto";

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createInternalCode(supplierId: string, supplierSku: string): string {
  const source = `${supplierId.trim()}|${supplierSku.trim()}`;
  return `P-${sha256(source).slice(0, 12).toUpperCase()}`;
}

export function createRunId(): string {
  return `run-${randomUUID()}`;
}
