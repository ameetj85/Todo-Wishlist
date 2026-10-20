// Small regex-based helpers for reading raw (un-rendered) HTML on the server.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  reg: "®",
  trade: "™",
  copy: "©",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  pound: "£",
  euro: "€",
  yen: "¥",
  cent: "¢",
  times: "×",
  deg: "°",
};

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);
}

export function decodeJsonEscapes(value: string) {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\\//g, "/");
}

export function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? null : decodeHtmlEntities(value).trim();
}

/** Visible text of an HTML fragment: tags, comments, scripts and styles removed, whitespace collapsed. */
export function htmlToText(fragment: string) {
  return decodeHtmlEntities(
    fragment
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Value of the first <meta> whose property/name/itemprop matches one of the keys, in key priority order. */
export function getMetaContent(html: string, keys: string[]) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const key of keys) {
    for (const tag of metaTags) {
      const name = (getAttribute(tag, "property") ?? getAttribute(tag, "name") ?? getAttribute(tag, "itemprop") ?? "").toLowerCase();
      const content = getAttribute(tag, "content");
      if (name === key && content) return content;
    }
  }

  return null;
}

/** Parsed contents of every <script type="application/ld+json"> block, skipping malformed ones. */
export function getJsonLdBlocks(html: string) {
  const results: unknown[] = [];
  const scripts = html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);

  for (const [, content] of scripts) {
    const cleaned = content
      .trim()
      .replace(/^<!\[CDATA\[|\]\]>$/g, "")
      .replace(/^\/\/\s*<!\[CDATA\[|\/\/\s*\]\]>$/g, "")
      .trim();

    try {
      results.push(JSON.parse(cleaned));
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }

  return results;
}
