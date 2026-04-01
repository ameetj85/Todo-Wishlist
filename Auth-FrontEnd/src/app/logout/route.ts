import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { logout } from "@/lib/auth-api";
import { AUTH_COOKIE_NAME, clearAuthToken, getAuthToken } from "@/lib/auth-cookie";

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (token) {
    await logout(token);
  }

  await clearAuthToken();
  revalidatePath("/");
  revalidatePath("/about");

  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  // Belt-and-suspenders: also clear the cookie directly on the redirect response,
  // because cookies() mutations may not always propagate into NextResponse.redirect().
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
