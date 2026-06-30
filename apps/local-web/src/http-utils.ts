import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

export function sendText(res: ServerResponse, status: number, value: string, type = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(value);
}

export async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  const maximum = Number(process.env.MAX_INPUT_BYTES ?? 20_971_520);
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maximum) throw new Error("요청 파일이 최대 허용 크기를 초과했습니다.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
