import sanitizeHtmlLibrary from "sanitize-html";

const allowedTags = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "h2",
  "h3"
];

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sanitizeHtml(input: string): { html: string; changed: boolean } {
  const html = sanitizeHtmlLibrary(input, {
    allowedTags,
    allowedAttributes: {},
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "xmp", "noscript"],
    nestingLimit: 20,
    parser: {
      lowerCaseTags: true
    }
  });

  return {
    html,
    changed: html !== input
  };
}
