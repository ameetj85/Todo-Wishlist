import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { logout } from "@/lib/auth-api";
import { clearAuthToken, getAuthToken } from "@/lib/auth-cookie";

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (token) {
    await logout(token);
  }

  await clearAuthToken();
  revalidatePath("/");
  revalidatePath("/about");

  const redirectUrl = new URL("/", request.url);
  return NextResponse.redirect(redirectUrl);
}
