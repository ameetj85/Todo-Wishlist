import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";

import { findProductDetails } from "@/lib/extract-product-details";
import { decodeHtmlEntities, decodeJsonEscapes, getAttribute, getJsonLdBlocks } from "@/lib/html-utils";

// Many retailers (Amazon in particular) serve a bot/captcha page to requests
// without browser-like headers, so mimic a regular desktop browser.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const HTML_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const IMAGE_ACCEPT = "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const MAX_CANDIDATES = 8;
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 100;
const MAX_ASPECT_RATIO = 4;
const TITLE_RELEVANCE_THRESHOLD = 0.5;

// Passes over the page when the title, price or image isn't found on the first fetch.
const EXTRACTION_ATTEMPTS = 3;
const EXTRACTION_RETRY_DELAY_MS = 1_500;
const EXTRACTION_DEADLINE_MS = 30_000;

// Stored images are shown at most ~330 CSS px (grid view) and 80 px (list view), so 640 px
// keeps them crisp on 2x displays. WebP is roughly 30% smaller than JPEG at the same quality.
const OUTPUT_MAX_DIMENSION = 640;
const OUTPUT_QUALITY = 80;
const OUTPUT_MIN_QUALITY = 65;
const OUTPUT_TARGET_BYTES = 60 * 1024;

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "this", "that", "of", "in", "to", "by"]);

// Images that are almost never the product: vector icons, sprites, tracking pixels, logos.
const JUNK_IMAGE_PATTERN =
  /\.svg(?:[?#]|$)|(?:^|[/_.-])(?:sprites?|pixel|spacer|blank|transparent|logos?|icons?|favicon|badges?|placeholder|loading|spinner)(?:[/_.-]|$)|fls-na\.amazon|uedata|\/batch\/1\/|doubleclick|googletagmanager|facebook\.com\/tr/i;

const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|avif|gif)(?:[?#]|$)/i;

// Markers sites use for the main product image (Amazon's #landingImage, LCP hints, microdata).
const PRIMARY_IMAGE_PATTERN =
  /\s(?:id|class)=["']?[^"'>]*\b(?:landingImage|imgBlkFront|main-?image|primary-?image|product-?image|hero-?image|product-?photo)\b|\sfetchpriority=["']?high|\sitemprop=["']?image/i;

type ImageCandidate = { url: string; relevance: number; isPrimary: boolean; position: number };

function isPrivateAddress(address: string) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return lower === "::1" || lower === "::" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
  }

  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

// Guard against SSRF: only fetch http(s) URLs that resolve to public addresses.
async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true })).map((entry) => entry.address);

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Refusing to fetch a private address");
  }
}

// Follows redirects manually so every hop goes through the SSRF check.
async function safeFetch(rawUrl: string, accept: string, referer?: string) {
  let url = new URL(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(url);

    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { ...BROWSER_HEADERS, Accept: accept, ...(referer ? { Referer: referer } : {}) },
    });

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }

    return { response, finalUrl: url };
  }

  throw new Error("Too many redirects");
}

function largestFromSrcset(srcset: string) {
  let best: { url: string; size: number } | null = null;

  // Split on commas that separate entries, not commas inside URLs (e.g. Cloudinary transforms).
  for (const part of srcset.split(/,\s+(?=\S)/)) {
    const [url, descriptor = "1x"] = part.trim().split(/\s+/);
    const size = parseFloat(descriptor) || 1;
    if (url && (!best || size > best.size)) best = { url, size };
  }

  return best?.url ?? null;
}

// Highest-resolution source an element exposes, including zoom and lazy-load attributes.
function getBestSourceFromTag(tag: string) {
  for (const name of ["data-old-hires", "data-zoom-image", "data-zoom-src", "data-large-image", "data-large_image", "data-full-src", "data-hires"]) {
    const value = getAttribute(tag, name);
    if (value) return value;
  }

  // Amazon: data-a-dynamic-image='{"url":[width,height],...}'
  const dynamic = getAttribute(tag, "data-a-dynamic-image");
  if (dynamic) {
    try {
      const entries = Object.entries(JSON.parse(dynamic) as Record<string, [number, number]>);
      entries.sort((x, y) => y[1][0] * y[1][1] - x[1][0] * x[1][1]);
      if (entries[0]) return entries[0][0];
    } catch {
      // fall through to the regular attributes
    }
  }

  // Lazy loaders keep the real URL in a data-* attribute and put a placeholder in src/srcset
  // until the image scrolls into view, so data-* attributes win over src.
  const srcset =
    getAttribute(tag, "data-srcset") ??
    getAttribute(tag, "data-lazy-srcset") ??
    getAttribute(tag, "data-original-set") ??
    getAttribute(tag, "srcset");
  const fromSrcset = srcset ? largestFromSrcset(srcset) : null;

  const candidates = [
    fromSrcset,
    getAttribute(tag, "data-src"),
    getAttribute(tag, "data-lazy-src"),
    getAttribute(tag, "data-original"),
    getAttribute(tag, "data-lazy"),
    getAttribute(tag, "data-echo"),
    getAttribute(tag, "data-ll-src"),
    getAttribute(tag, "data-img-src"),
    getAttribute(tag, "data-image"),
    getAttribute(tag, "data-img"),
    getAttribute(tag, "data-orig-file"),
    getAttribute(tag, "data-large-file"),
    getAttribute(tag, "data-pin-media"),
    getAttribute(tag, "data-url"),
    getAttribute(tag, "data-bg"),
    getAttribute(tag, "data-background-image"),
    getAttribute(tag, "src"),
  ];

  const source = candidates.find((value) => value && !value.startsWith("data:")) ?? null;
  return source ? fillWidthTemplate(source, getAttribute(tag, "data-widths")) : null;
}

// Responsive lazy loaders (lazysizes, Shopify themes) use templates like "product_{width}x.jpg"
// with the allowed widths in data-widths="[180,360,720,1080]".
function fillWidthTemplate(url: string, widths: string | null) {
  if (!/\{width\}|%7Bwidth%7D/i.test(url)) return url;

  const allowed = (widths?.match(/\d+/g) ?? []).map(Number).filter((width) => width > 0);
  const width = allowed.length > 0 ? Math.max(...allowed.filter((value) => value <= 1200), Math.min(...allowed)) : 1024;
  return url.replace(/\{width\}|%7Bwidth%7D/gi, String(width));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

// Fraction of the title's words that appear in the image's descriptive text.
function titleRelevance(titleTokens: string[], text: string) {
  if (titleTokens.length === 0 || !text) return 0;
  const textTokens = new Set(tokenize(text));
  const hits = titleTokens.filter((token) => textTokens.has(token)).length;

  // A single shared word (e.g. a colour) is too weak a signal for multi-word titles.
  if (hits < Math.min(2, titleTokens.length)) return 0;

  return hits / titleTokens.length;
}

function isTooSmallByAttributes(tag: string) {
  const width = Number.parseInt(getAttribute(tag, "width") ?? "", 10);
  const height = Number.parseInt(getAttribute(tag, "height") ?? "", 10);
  return (width > 0 && width < MIN_IMAGE_DIMENSION) || (height > 0 && height < MIN_IMAGE_DIMENSION);
}

/**
 * <img> and <picture> elements in document order. For <picture>, the largest
 * <source srcset> wins over the fallback <img>. <noscript> fallbacks are
 * included naturally since their markup is still present in the raw HTML.
 */
function getInlineImages(html: string, titleTokens: string[]) {
  const results: ImageCandidate[] = [];
  const elements = html.matchAll(/<picture\b[\s\S]*?<\/picture>|<img\b[^>]*>/gi);

  for (const [element] of elements) {
    const isPicture = /^<picture/i.test(element);
    const imgTag = isPicture ? element.match(/<img\b[^>]*>/i)?.[0] ?? "" : element;

    if (imgTag && isTooSmallByAttributes(imgTag)) continue;

    let source: string | null = null;

    if (isPicture) {
      const sources = [...element.matchAll(/<source\b[^>]*>/gi)]
        .map(([tag]) => getAttribute(tag, "data-srcset") ?? getAttribute(tag, "srcset"))
        .filter((value): value is string => Boolean(value))
        .map(largestFromSrcset);
      source = (imgTag ? getBestSourceFromTag(imgTag) : null) ?? sources.find(Boolean) ?? null;
    } else {
      source = getBestSourceFromTag(imgTag);
    }

    if (!source) continue;

    const description = [getAttribute(imgTag, "alt"), getAttribute(imgTag, "title"), getAttribute(imgTag, "aria-label")]
      .filter(Boolean)
      .join(" ");

    results.push({
      url: source,
      relevance: titleRelevance(titleTokens, description),
      isPrimary: PRIMARY_IMAGE_PATTERN.test(imgTag),
      position: results.length,
    });
  }

  return results;
}

// Images the page declares as its primary image for link previews and search engines.
function getDeclaredImages(html: string) {
  const results: string[] = [];
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const metaKeys = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image", "twitter:image:src", "image", "thumbnail"];

  for (const key of metaKeys) {
    for (const tag of metaTags) {
      const name = (
        getAttribute(tag, "property") ??
        getAttribute(tag, "name") ??
        getAttribute(tag, "itemprop") ??
        ""
      ).toLowerCase();
      const content = getAttribute(tag, "content");
      if (name === key && content) results.push(content);
    }
  }

  // Schema.org microdata on non-meta elements, e.g. <img itemprop="image" src="...">.
  for (const [tag] of html.matchAll(/<(?:img|link|a|div|span)\b[^>]*itemprop=["']?image["']?[^>]*>/gi)) {
    const value = getAttribute(tag, "content") ?? getAttribute(tag, "href") ?? getBestSourceFromTag(tag);
    if (value) results.push(value);
  }

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (getAttribute(tag, "rel") ?? "").toLowerCase();
    const as = (getAttribute(tag, "as") ?? "").toLowerCase();
    const href = getAttribute(tag, "href") ?? largestFromSrcset(getAttribute(tag, "imagesrcset") ?? "");
    if (!href) continue;
    if (rel === "image_src" || (rel === "preload" && as === "image")) results.push(href);
  }

  return results;
}

function collectJsonLdImages(node: unknown, results: string[], insideProduct = false) {
  if (!node) return;

  if (typeof node === "string") {
    if (insideProduct) results.push(node);
    return;
  }

  if (typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((child) => collectJsonLdImages(child, results, insideProduct));
    return;
  }

  const record = node as Record<string, unknown>;
  const types = ([] as unknown[]).concat(record["@type"] ?? []).map((type) => String(type).toLowerCase());
  const isProduct = types.some((type) => type.includes("product") || type === "offer" || type === "itempage");

  if (types.includes("imageobject")) {
    const url = record.contentUrl ?? record.url;
    if (typeof url === "string" && (insideProduct || isProduct)) results.push(url);
    return;
  }

  if (isProduct) {
    collectJsonLdImages(record.image, results, true);
    collectJsonLdImages(record.thumbnailUrl, results, true);
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "image" || key === "thumbnailUrl") continue;
    if (value && typeof value === "object") collectJsonLdImages(value, results, false);
  }
}

function getJsonLdImages(html: string) {
  const results: string[] = [];
  getJsonLdBlocks(html).forEach((block) => collectJsonLdImages(block, results));
  return results;
}

// Amazon keeps the full gallery in inline scripts as "hiRes"/"large" URLs.
function getAmazonGalleryImages(html: string) {
  return [...html.matchAll(/"(?:hiRes|large|mainUrl)"\s*:\s*"(https:[^"]+)"/g)].map(([, url]) => decodeJsonEscapes(url));
}

// CSS background images, e.g. <div style="background-image: url('...')">.
// Lazy background loaders keep the URL in data-bg / data-background-image / data-bgset instead.
function getBackgroundImages(html: string) {
  const inline = [...html.matchAll(/background(?:-image)?\s*:[^;"'>]*url\(\s*(?:&quot;|["'])?([^"')&]+)(?:&quot;|["'])?\s*\)/gi)].map(
    ([, url]) => decodeHtmlEntities(url),
  );
  const lazy = [...html.matchAll(/\sdata-(?:bg|background-image|bgset|bg-src)=["']([^"']+)["']/gi)]
    .map(([, value]) => decodeHtmlEntities(value).replace(/^url\(\s*["']?|["']?\s*\)$/g, ""))
    .map((value) => largestFromSrcset(value) ?? value);

  return [...inline, ...lazy];
}

// Last resort for script-rendered pages (Next.js, Shopify, etc.): absolute image URLs inside scripts.
function getScriptImages(html: string) {
  const results: string[] = [];

  for (const [, content] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const [match] of decodeJsonEscapes(content).matchAll(/https?:\/\/[^\s"'<>()\\]+?\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>()\\]*)?/gi)) {
      results.push(match);
    }
  }

  return results;
}

// Rewrite known CDN thumbnail URLs to their full-size originals.
function upgradeImageUrl(url: string) {
  // Amazon: .../images/I/61F+xb9taBL._SX342_SY445_QL70_.jpg -> .../images/I/61F+xb9taBL.jpg
  if (/(?:media-amazon|ssl-images-amazon)\.com\/images\/I\//i.test(url)) {
    return url.replace(/\._[^/]*_(\.[a-z]+)$/i, "$1");
  }

  const parsed = new URL(url);

  // Walmart: ?odnHeight=160&odnWidth=160 -> original size
  if (/walmartimages\.com$/i.test(parsed.hostname)) {
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^odn/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  }

  // Shopify: product_100x100.jpg?width=100 -> product.jpg
  if (/(?:cdn\.shopify\.com|\/cdn\/shop\/)/i.test(url)) {
    parsed.pathname = parsed.pathname.replace(/_(?:\d+x\d*|\d*x\d+)(?:@\dx)?(?:_crop_\w+)?(?=\.[a-z]+$)/i, "");
    parsed.searchParams.delete("width");
    parsed.searchParams.delete("height");
    return parsed.toString();
  }

  // eBay: .../s-l64.jpg -> .../s-l1600.jpg
  if (/ebayimg\.com$/i.test(parsed.hostname)) {
    parsed.pathname = parsed.pathname.replace(/\/s-l\d+(\.[a-z]+)$/i, "/s-l1600$1");
    return parsed.toString();
  }

  return url;
}

function normalizeCandidate(raw: string, baseUrl: URL) {
  const value = raw.trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("javascript:")) {
    return null;
  }

  try {
    const url = upgradeImageUrl(new URL(value, baseUrl).toString());
    return JUNK_IMAGE_PATTERN.test(url) ? null : url;
  } catch {
    return null;
  }
}

/**
 * Candidate image URLs in priority order:
 *   1. inline images whose alt/title text matches the item title (best match first),
 *   2. the page's declared product image (JSON-LD Product, og:image, twitter:image, microdata),
 *   3. the inline image the page marks as its main image,
 *   4. other inline images, gallery data, CSS backgrounds and image URLs embedded in scripts.
 */
export function findImageCandidates(html: string, pageUrl: string, title?: string) {
  const baseHref = html.match(/<base\b[^>]*href=["']([^"']+)["']/i)?.[1];
  const baseUrl = new URL(baseHref ? decodeHtmlEntities(baseHref) : pageUrl, pageUrl);
  const titleTokens = tokenize(title ?? "");

  const inlineImages = getInlineImages(html, titleTokens);
  // Best title match first; ties go to the page's main image, then to whichever appears first.
  const titleMatches = inlineImages
    .filter((image) => image.relevance >= TITLE_RELEVANCE_THRESHOLD)
    .sort(
      (a, b) =>
        b.relevance - a.relevance || Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
    );
  const otherInline = inlineImages.filter((image) => image.relevance < TITLE_RELEVANCE_THRESHOLD);

  const ordered = [
    ...titleMatches.map((image) => image.url),
    ...getJsonLdImages(html),
    ...getDeclaredImages(html),
    ...otherInline.filter((image) => image.isPrimary).map((image) => image.url),
    ...getAmazonGalleryImages(html),
    ...otherInline.filter((image) => !image.isPrimary).map((image) => image.url),
    ...getBackgroundImages(html),
    ...getScriptImages(html).filter((url) => IMAGE_EXTENSION_PATTERN.test(url)),
  ];

  const unique = new Set<string>();
  for (const raw of ordered) {
    const url = normalizeCandidate(raw, baseUrl);
    if (url) unique.add(url);
  }

  return [...unique];
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_DOWNLOAD_BYTES) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.byteLength > MAX_DOWNLOAD_BYTES ? null : buffer;
}

/**
 * Re-encodes any image sharp can decode into the compact format stored for wishlist items.
 * Throws if the input is not a decodable image.
 * Keep in sync with Auth-REST-API/scripts/db-recompress-images.js.
 */
export async function compressImageForStorage(inputBuffer: Buffer) {
  const encode = (quality: number) =>
    sharp(inputBuffer)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: OUTPUT_MAX_DIMENSION,
        height: OUTPUT_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();

  // Highly detailed photos can still be large at the default quality; step quality down
  // a little (never below a level where artefacts become visible) rather than shrinking.
  let quality = OUTPUT_QUALITY;
  let outputBuffer = await encode(quality);

  while (outputBuffer.byteLength > OUTPUT_TARGET_BYTES && quality > OUTPUT_MIN_QUALITY) {
    quality = Math.max(OUTPUT_MIN_QUALITY, quality - 5);
    outputBuffer = await encode(quality);
  }

  return outputBuffer;
}

async function downloadImageAsBase64(imageUrl: string, pageUrl: string) {
  const { response } = await safeFetch(imageUrl, IMAGE_ACCEPT, pageUrl);
  if (!response.ok) return null;

  // Some CDNs mislabel images (e.g. application/octet-stream), so let sharp decide what is an image.
  const contentType = response.headers.get("content-type") ?? "";
  if (/text\/html|svg|json|javascript/i.test(contentType)) return null;

  const imageBuffer = await readLimitedBody(response);
  if (!imageBuffer) return null;

  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (metadata.format === "svg" || width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) return null;
  if (Math.max(width, height) / Math.min(width, height) > MAX_ASPECT_RATIO) return null;

  const optimizedBuffer = await compressImageForStorage(imageBuffer);
  return optimizedBuffer.toString("base64");
}

export type ExtractedItemInfo = {
  title: string | null;
  price: number | null;
  imageBase64: string | null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPageHtml(url: string) {
  const { response, finalUrl } = await safeFetch(url, HTML_ACCEPT);
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/html|xml|text\/plain/i.test(contentType)) return null;

  return { html: await response.text(), finalUrl: finalUrl.toString() };
}

/**
 * Title, price and image for the product page at `rawUrl`.
 *
 * Raw HTML is all a server-side fetch sees, so lazily loaded images often aren't in their
 * final form on the first pass, and retailers intermittently return bot-check or skeleton
 * pages. Extraction therefore runs up to EXTRACTION_ATTEMPTS passes: each pass re-fetches
 * the page, fills in whatever is still missing, and tries the next batch of image candidates
 * it hasn't tried yet, backing off a little longer between passes.
 */
export async function extractItemInfoFromPage(rawUrl: string, titleHint?: string): Promise<ExtractedItemInfo> {
  const result: ExtractedItemInfo = { title: null, price: null, imageBase64: null };
  const deadline = Date.now() + EXTRACTION_DEADLINE_MS;
  const triedImages = new Set<string>();

  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).toString();
  } catch {
    return result;
  }

  // Direct links to an image file need no page parsing.
  if (IMAGE_EXTENSION_PATTERN.test(new URL(normalizedUrl).pathname)) {
    result.imageBase64 = await downloadImageAsBase64(normalizedUrl, normalizedUrl).catch(() => null);
    if (result.imageBase64) return result;
  }

  for (let attempt = 1; attempt <= EXTRACTION_ATTEMPTS && Date.now() < deadline; attempt += 1) {
    if (attempt > 1) await wait(EXTRACTION_RETRY_DELAY_MS * (attempt - 1));

    const page = await fetchPageHtml(normalizedUrl).catch(() => null);

    if (!page) continue;

    try {
      const details = findProductDetails(page.html, page.finalUrl);
      result.title ??= details.title;
      result.price ??= details.price;

      if (!result.imageBase64) {
        const relevanceTitle = titleHint || result.title || undefined;
        const candidates = findImageCandidates(page.html, page.finalUrl, relevanceTitle)
          .filter((candidate) => !triedImages.has(candidate))
          .slice(0, MAX_CANDIDATES);

        // Try each candidate in priority order until one downloads as a real, reasonably sized image.
        for (const candidate of candidates) {
          if (Date.now() >= deadline) break;
          triedImages.add(candidate);

          try {
            result.imageBase64 = await downloadImageAsBase64(candidate, page.finalUrl);
            if (result.imageBase64) break;
          } catch {
            // try the next candidate
          }
        }
      }
    } catch {
      // unparseable page; retry on the next pass
    }

    // Many pages genuinely have no price in their HTML, so only a missing title or image forces another pass.
    if (result.title && result.imageBase64) break;
  }

  return result;
}

export async function extractImageFromPage(rawUrl: string, title?: string) {
  try {
    return (await extractItemInfoFromPage(rawUrl, title)).imageBase64;
  } catch {
    return null;
  }
}
