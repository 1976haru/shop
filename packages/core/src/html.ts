const allowedTags = new Set(["p","br","strong","em","ul","ol","li","table","thead","tbody","tr","th","td","h2","h3"]);

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function sanitizeHtml(input: string): { html: string; changed: boolean } {
  let changed = false;
  let html = input.replace(/<script[\s\S]*?<\/script>/gi, () => { changed = true; return ""; })
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, () => { changed = true; return ""; })
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, () => { changed = true; return ""; })
    .replace(/javascript:/gi, () => { changed = true; return ""; });
  html = html.replace(/<\/?([a-z0-9]+)(?:\s[^>]*)?>/gi, (match, tag) => {
    if (!allowedTags.has(String(tag).toLowerCase())) { changed = true; return ""; }
    return match.startsWith("</") ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
  return { html, changed };
}
