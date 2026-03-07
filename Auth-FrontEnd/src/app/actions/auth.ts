"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  forgotPassword,
  login,
  logout,
  resetPassword,
  signup,
} from "@/lib/auth-api";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth-cookie";

export type ActionState = {
  error?: string;
  success?: string;
};

function getSafeNextPath(value: FormDataEntryValue | null) {
  const nextPath = typeof value === "string" ? value : "/about";

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/about";
  }

  return nextPath;
}

export async function loginAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNextPath(formData.get("next"));

  const response = await login({ email, password });

  if (!response.ok) {
    return { error: response.error };
  }

  await setAuthToken(response.data.token, response.data.expiresIn);
  revalidatePath("/");
  revalidatePath("/about");

  redirect(nextPath);
}

export async function signupAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const response = await signup({ name, email, password });

  if (!response.ok) {
    return { error: response.error };
  }

  await setAuthToken(response.data.token, response.data.expiresIn);
  revalidatePath("/");
  revalidatePath("/about");

  redirect("/about");
}

export async function logoutAction() {
  const token = await getAuthToken();

  if (token) {
    await logout(token);
  }

  await clearAuthToken();
  revalidatePath("/");
  revalidatePath("/about");

  redirect("/");
}

export async function forgotPasswordAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();

  const response = await forgotPassword({ email });

  if (!response.ok) {
    return { error: response.error };
  }

  return { success: response.data.message };
}

export async function resetPasswordAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const response = await resetPassword({ token, password });

  if (!response.ok) {
    return { error: response.error };
  }

  return { success: response.data.message };
}
