import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { publicRoot } from "./context.ts";
import { handleBasicApi } from "./api-basic.ts";
import { handleArtifactApi } from "./api-artifacts.ts";
import { handleAgentApi } from "./api-agent.ts";
import { sendJson, sendText } from "./http-utils.ts";

const staticFiles: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" }
};

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (await handleAgentApi(req, res, url)) return;
    if (await handleBasicApi(req, res, url)) return;
    if (handleArtifactApi(req, res, url)) return;

    const asset = staticFiles[url.pathname];
    if (!asset) {
      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, {
          error: { code: "NOT_FOUND", message: "API 경로를 찾을 수 없습니다." }
        });
      } else {
        sendText(res, 404, "Not found");
      }
      return;
    }

    const content = await readFile(`${publicRoot}/${asset.file}`);
    res.writeHead(200, {
      "content-type": asset.type,
      "content-security-policy":
        "default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:"
    });
    res.end(content);
  } catch (error) {
    sendJson(res, 400, {
      error: {
        code: "REQUEST_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
}
