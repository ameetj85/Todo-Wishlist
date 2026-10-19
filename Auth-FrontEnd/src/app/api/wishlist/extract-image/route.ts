import { NextResponse } from "next/server";

import { getAuthToken } from "@/lib/auth-cookie";
import { extractImageFromPage } from "@/lib/extract-image";

type ExtractImageBody = {
  url?: string;
  title?: string;
};

export async function POST(request: Request) {
  if (!(await getAuthToken())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const imageBase64 = await extractImageFromPage(url, title);

  return NextResponse.json({ imageBase64 });
}
