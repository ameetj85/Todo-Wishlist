import { NextResponse } from "next/server";
import sharp from "sharp";

type ExtractImageBody = {
  url?: string;
  title?: string;
};

function getFirstImageSource(html: string, title?: string) {
  if (title) {
    // Find img tag where alt attribute contains a part of the title
    const titleLower = title.toLowerCase();
    const altMatches = html.matchAll(/<img[^>]+alt=["']([^"']*)["'][^>]+src=["']([^"']+)["']|<img[^>]+src=["']([^"']+)["'][^>]+alt=["']([^"']*)["']/gi);
    
    for (const match of altMatches) {
      const altText = (match[1] || match[4] || "").toLowerCase();
      const src = match[2] || match[3];
      
      if (altText.includes(titleLower)) {
        return src;
      }
    }
  }
  
  // Fallback to first image if no title match or no title provided
  const imageTagMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imageTagMatch?.[1] ?? null;
}

const MAX_IMAGE_BYTES = 700 * 1024;

async function optimizeImageBuffer(inputBuffer: Buffer) {
  let width = 800;
  let quality = 82;
  let attempts = 0;
  let outputBuffer = inputBuffer;

  // Iteratively reduce dimensions/quality until the payload is small enough.
  while (attempts < 6) {
    outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (outputBuffer.byteLength <= MAX_IMAGE_BYTES) {
      return outputBuffer;
    }

    width = Math.max(240, Math.floor(width * 0.8));
    quality = Math.max(45, quality - 8);
    attempts += 1;
  }

  return outputBuffer;
}

async function tryExtractFirstImageAsBase64(rawUrl: string, title?: string) {
  try {
    const normalizedPageUrl = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;

    const pageResponse = await fetch(normalizedPageUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!pageResponse.ok) {
      return null;
    }

    const html = await pageResponse.text();
    const firstImageSource = getFirstImageSource(html, title);

    if (!firstImageSource) {
      return null;
    }

    const resolvedImageUrl = new URL(firstImageSource, pageResponse.url).toString();
    const imageResponse = await fetch(resolvedImageUrl, {
      cache: "no-store",
      headers: {
        Accept: "image/*",
      },
    });

    if (!imageResponse.ok) {
      return null;
    }

    const contentType = imageResponse.headers.get("content-type") ?? "";

    if (!contentType.startsWith("image/")) {
      return null;
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const optimizedBuffer = await optimizeImageBuffer(imageBuffer);
    return optimizedBuffer.toString("base64");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: ExtractImageBody;

  try {
    body = (await request.json()) as ExtractImageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = String(body.url ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const imageBase64 = await tryExtractFirstImageAsBase64(url, title);

  return NextResponse.json({ imageBase64 });
}
