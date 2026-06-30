export function createInternalCode(supplierId: string, supplierSku: string): string {
  const source = (supplierId + "-" + supplierSku).toUpperCase();
  let value = 0;
  for (let index = 0; index < source.length; index += 1) {
    value = (value * 31 + source.charCodeAt(index)) >>> 0;
  }
  const suffix = value.toString(16).toUpperCase().padStart(8, "0");
  return "P-" + suffix + "0000";
}

export function createRunId(): string {
  return "run-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
