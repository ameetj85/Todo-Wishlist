import { decodeJsonEscapes, getAttribute, getJsonLdBlocks, getMetaContent, htmlToText } from "@/lib/html-utils";

const MAX_TITLE_LENGTH = 200;
const MAX_PLAUSIBLE_PRICE = 1_000_000;

// Ids/classes sites use for the product name element (Amazon's #productTitle, common PDP themes).
const TITLE_ELEMENT_PATTERN =
  /<(h1|h2|span|div|p)\b[^>]*\s(?:id|class)=["'][^"']*\b(?:productTitle|product[-_]?title|product[-_]?name|productName|pdp[-_]?title|pdp[-_]?product[-_]?name|item[-_]?title|x-item-title)\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i;

// Price elements that are *not* the current price: strikethrough, list, "was" and per-unit prices.
const NON_CURRENT_PRICE_PATTERN =
  /\b(?:was|old|original|compare|crossed|strike|regular|list|rrp|msrp|before|savings?|discount|per[-_]?unit|unit[-_]?price|installment|monthly)/i;

const CURRENCY_PATTERN = String.raw`(?:US\s?\$|CA\$|C\$|A\$|AU\$|NZ\$|HK\$|S\$|R\$|[$€£¥₹₩₽₺₪]|Rs\.?|USD|EUR|GBP|CAD|AUD|INR|JPY|CHF|SEK|NOK|DKK|PLN|MXN|BRL|ZAR)`;
const AMOUNT_PATTERN = String.raw`(\d{1,3}(?:[.,\s  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const PRICE_WITH_CURRENCY = new RegExp(
  `${CURRENCY_PATTERN}\\s?${AMOUNT_PATTERN}|${AMOUNT_PATTERN}\\s?${CURRENCY_PATTERN}`,
  "i",
);

export type ProductDetails = {
  title: string | null;
  price: number | null;
};

/** Converts "1,299.00", "1.299,00", "1 299,00", "19,99" or "1299" into a number. */
function parseAmount(raw: string) {
  const value = raw.replace(/[\s  ]/g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized = value;

  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever separator comes last is the decimal separator.
    normalized =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "19,99" is a decimal comma; "1,299" is a thousands separator.
    normalized = /,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) {
    normalized = value.replace(/\./g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount < MAX_PLAUSIBLE_PRICE
    ? Math.round(amount * 100) / 100
    : null;
}

/** A price from structured data, where the value may be a bare number or a string with or without a currency. */
function parseStructuredPrice(value: unknown) {
  if (typeof value === "number") return parseAmount(String(value));
  if (typeof value !== "string" || !value.trim()) return null;

  const withCurrency = value.match(PRICE_WITH_CURRENCY);
  if (withCurrency) return parseAmount(withCurrency[1] ?? withCurrency[2]);

  const bare = value.match(new RegExp(AMOUNT_PATTERN));
  return bare ? parseAmount(bare[1]) : null;
}

/** A price from visible text, which must carry a currency marker to avoid picking up ratings or counts. */
function parseTextPrice(text: string) {
  const match = text.match(PRICE_WITH_CURRENCY);
  return match ? parseAmount(match[1] ?? match[2]) : null;
}

function cleanTitle(value: string | null | undefined) {
  if (!value) return null;
  const text = htmlToText(value).slice(0, MAX_TITLE_LENGTH * 2).trim();
  if (!text) return null;
  return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : text;
}

function getSiteNames(html: string, pageUrl: string) {
  const names = new Set<string>();
  const siteName = getMetaContent(html, ["og:site_name", "application-name", "apple-mobile-web-app-title"]);
  if (siteName) names.add(siteName.toLowerCase());

  try {
    const host = new URL(pageUrl).hostname.replace(/^www\d*\./i, "");
    names.add(host.toLowerCase());
    // "shop.example.co.uk" -> "example"
    const labels = host.split(".");
    const main = labels.length > 2 && labels.at(-2)!.length <= 3 ? labels.at(-3) : labels.at(-2);
    if (main) names.add(main.toLowerCase());
  } catch {
    // ignore invalid URLs
  }

  return [...names].filter((name) => name.length >= 2);
}

// "Logitech MX Master 3S | Best Buy" -> "Logitech MX Master 3S"
function stripSiteName(title: string, siteNames: string[]) {
  let result = title
    .replace(/^Amazon(?:\.[a-z.]+)?\s*:\s*/i, "")
    .replace(/^Buy\s+/i, "")
    .trim();

  const separators = /\s+[|–—:·•»-]\s+/;
  const segments = result.split(separators);

  if (segments.length > 1) {
    const kept = segments.filter((segment) => {
      const normalized = segment.toLowerCase().replace(/[^a-z0-9.]+/g, "");
      return !siteNames.some((name) => {
        const site = name.replace(/[^a-z0-9.]+/g, "");
        return normalized === site || normalized === `${site}.com` || (normalized.includes(site) && segment.split(/\s+/).length <= 3);
      });
    });

    // Amazon appends the category ("... : Electronics"); drop a trailing one-word segment.
    if (kept.length > 1 && /^amazon/i.test(title) && kept.at(-1)!.split(/\s+/).length <= 3) kept.pop();

    if (kept.length > 0) result = kept.join(" - ");
  }

  return result.trim();
}

/** Every JSON-LD node (flattening @graph and nested arrays/objects) whose @type is a product. */
function getJsonLdProducts(html: string) {
  const products: Record<string, unknown>[] = [];

  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 8) return;

    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, depth + 1));
      return;
    }

    const record = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(record["@type"] ?? []).map((type) => String(type).toLowerCase());
    if (types.some((type) => type === "product" || type === "productgroup" || type === "individualproduct" || type.endsWith("/product"))) {
      products.push(record);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };

  getJsonLdBlocks(html).forEach((block) => visit(block, 0));
  return products;
}

function getOfferPrice(offers: unknown, depth = 0): number | null {
  if (!offers || depth > 4) return null;

  if (Array.isArray(offers)) {
    // Prefer in-stock offers, then the lowest price.
    const prices = offers
      .map((offer) => ({
        price: getOfferPrice(offer, depth + 1),
        inStock: /instock/i.test(String((offer as Record<string, unknown>)?.availability ?? "")),
      }))
      .filter((entry): entry is { price: number; inStock: boolean } => entry.price !== null);
    prices.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price);
    return prices[0]?.price ?? null;
  }

  if (typeof offers !== "object") return parseStructuredPrice(offers);

  const offer = offers as Record<string, unknown>;
  for (const key of ["price", "lowPrice", "highPrice"]) {
    const price = parseStructuredPrice(offer[key]);
    if (price !== null) return price;
  }

  return getOfferPrice(offer.priceSpecification, depth + 1) ?? getOfferPrice(offer.offers, depth + 1);
}

function getJsonLdDetails(html: string): ProductDetails {
  let title: string | null = null;
  let price: number | null = null;

  for (const product of getJsonLdProducts(html)) {
    title ??= typeof product.name === "string" ? cleanTitle(product.name) : null;
    price ??= getOfferPrice(product.offers) ?? getOfferPrice(product.hasVariant);
    if (title && price !== null) break;
  }

  return { title, price };
}

// Text of the first element whose opening tag matches, up to its closing tag (or a short window).
function getElementText(html: string, openingTag: RegExp, windowSize = 400) {
  const match = openingTag.exec(html);
  if (!match) return null;

  const start = match.index + match[0].length;
  const tagName = match[0].match(/^<([a-z0-9]+)/i)?.[1];
  const closing = tagName ? html.indexOf(`</${tagName}`, start) : -1;
  const end = closing >= 0 && closing - start < windowSize ? closing : start + windowSize;
  return htmlToText(html.slice(start, end));
}

function getTitleFromHtml(html: string, pageUrl: string) {
  const siteNames = getSiteNames(html, pageUrl);
  const element = html.match(TITLE_ELEMENT_PATTERN);

  const candidates = [
    element ? cleanTitle(element[2]) : null,
    cleanTitle(getMetaContent(html, ["og:title", "twitter:title", "name", "title"])),
    cleanTitle(getElementText(html, /<[a-z0-9]+\b[^>]*\sitemprop=["']?name["']?[^>]*>/i)),
    cleanTitle(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
    cleanTitle(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const stripped = stripSiteName(candidate, siteNames);
    // Skip generic captcha/error/landing-page titles.
    if (stripped.length >= 3 && !/^(?:robot check|access denied|page not found|404|just a moment|attention required|sign in|home)\b/i.test(stripped)) {
      return stripped;
    }
  }

  return null;
}

function getPriceFromMeta(html: string) {
  const price = parseStructuredPrice(
    getMetaContent(html, ["product:price:amount", "og:price:amount", "product:sale_price:amount", "price"]),
  );
  if (price !== null) return price;

  // Shopify and others: <meta name="twitter:label1" content="Price"><meta name="twitter:data1" content="$19.99">
  for (const index of ["1", "2"]) {
    if (/price/i.test(getMetaContent(html, [`twitter:label${index}`]) ?? "")) {
      const value = parseTextPrice(getMetaContent(html, [`twitter:data${index}`]) ?? "");
      if (value !== null) return value;
    }
  }

  return null;
}

function getPriceFromMicrodata(html: string) {
  for (const [tag] of html.matchAll(/<[a-z0-9]+\b[^>]*\sitemprop=["']?(?:price|lowPrice)["']?[^>]*>/gi)) {
    const price = parseStructuredPrice(getAttribute(tag, "content") ?? getAttribute(tag, "value"));
    if (price !== null) return price;
  }

  const text = getElementText(html, /<[a-z0-9]+\b[^>]*\sitemprop=["']?price["']?[^>]*>/i, 120);
  return text ? parseStructuredPrice(text) : null;
}

function getAmazonPrice(html: string) {
  const patterns = [
    // The "price to pay" block in the buy box.
    /\b(?:priceToPay|apexPriceToPay|apex-pricetopay-value)\b[\s\S]{0,600}?class=["'][^"']*\ba-offscreen\b[^"']*["'][^>]*>([^<]+)</i,
    /\bid=["'](?:corePrice_feature_div|corePriceDisplay_desktop_feature_div|corePrice_desktop)["'][\s\S]{0,1500}?class=["'][^"']*\ba-offscreen\b[^"']*["'][^>]*>([^<]+)</i,
    /\bid=["'](?:priceblock_ourprice|priceblock_dealprice|priceblock_saleprice|price_inside_buybox|newBuyBoxPrice|kindle-price|price)["'][^>]*>([^<]+)</i,
  ];

  for (const pattern of patterns) {
    const text = html.match(pattern)?.[1];
    const price = text ? parseTextPrice(text) ?? parseStructuredPrice(text) : null;
    if (price !== null) return price;
  }

  const amount = html.match(/"priceAmount"\s*:\s*"?(\d+(?:\.\d+)?)/)?.[1];
  return amount ? parseAmount(amount) : null;
}

function getPriceFromDataAttributes(html: string) {
  for (const [tag] of html.matchAll(/<[a-z0-9]+\b[^>]*\sdata-(?:price-amount|product-price|sale-price|current-price|price)=[^>]*>/gi)) {
    if (NON_CURRENT_PRICE_PATTERN.test(getAttribute(tag, "class") ?? "")) continue;

    for (const name of ["data-price-amount", "data-sale-price", "data-current-price", "data-product-price", "data-price"]) {
      const price = parseStructuredPrice(getAttribute(tag, name));
      if (price !== null) return price;
    }
  }

  return null;
}

// Elements whose id/class mentions "price" and whose text contains an amount with a currency.
function getPriceFromPriceElements(html: string) {
  const elements = html.matchAll(/<([a-z0-9]+)\b[^>]*\s(?:id|class|data-testid|data-test|data-automation-id)=["']([^"']*price[^"']*)["'][^>]*>/gi);

  for (const element of elements) {
    if (NON_CURRENT_PRICE_PATTERN.test(element[2])) continue;

    const start = element.index + element[0].length;
    const text = htmlToText(html.slice(start, start + 300).split(/<\/(?:div|li|section|tr|p)>/i)[0]);
    const price = parseTextPrice(text);
    if (price !== null) return price;
  }

  return null;
}

// Last resort for script-rendered pages: price fields inside embedded JSON (Next.js, Nuxt, Shopify, etc.).
function getPriceFromScripts(html: string) {
  const keys = String.raw`(?:currentPrice|salePrice|finalPrice|offerPrice|sellingPrice|priceAmount|displayPrice|formattedPrice|price)`;
  const pattern = new RegExp(String.raw`"${keys}"\s*:\s*(?:\{[^{}]*?"(?:value|amount|price)"\s*:\s*)?"?([^",{}\]]{1,24})`, "gi");
  let integerFallback: number | null = null;

  for (const [, content] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const [, raw] of decodeJsonEscapes(content).matchAll(pattern)) {
      const value = raw.trim();
      if (!/\d/.test(value)) continue;

      // Prefer values that look like money ("19.99", "$19.99") over bare integers, which are often cents or ids.
      if (/[.,]\d{2}\b/.test(value) || PRICE_WITH_CURRENCY.test(value)) {
        const price = parseStructuredPrice(value);
        if (price !== null) return price;
      } else if (integerFallback === null && /^\d{1,6}$/.test(value)) {
        integerFallback = parseAmount(value);
      }
    }
  }

  return integerFallback;
}

/**
 * Item title and price from a product page, trying the most reliable sources first:
 * JSON-LD Product data, Open Graph / product meta tags, schema.org microdata, well-known
 * retailer markup, generic "price"/"title" elements, and finally JSON embedded in scripts.
 */
export function findProductDetails(html: string, pageUrl: string): ProductDetails {
  const structured = getJsonLdDetails(html);

  const title = structured.title ? stripSiteName(structured.title, getSiteNames(html, pageUrl)) : getTitleFromHtml(html, pageUrl);

  const price =
    structured.price ??
    getPriceFromMeta(html) ??
    getPriceFromMicrodata(html) ??
    getAmazonPrice(html) ??
    getPriceFromDataAttributes(html) ??
    getPriceFromPriceElements(html) ??
    getPriceFromScripts(html);

  return { title: title || null, price };
}
