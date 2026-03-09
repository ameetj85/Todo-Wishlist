import { NextResponse } from "next/server";

type ExtractImageBody = {
  url?: string;
};

function getFirstImageSource(html: string) {
  const imageTagMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imageTagMatch?.[1] ?? null;
}

async function tryExtractFirstImageAsBase64(rawUrl: string) {
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
    const firstImageSource = getFirstImageSource(html);

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
    return imageBuffer.toString("base64");
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

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const imageBase64 = await tryExtractFirstImageAsBase64(url);

  return NextResponse.json({ imageBase64 });
}
