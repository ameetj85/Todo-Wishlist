"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  changePassword,
  forgotPassword,
  login,
  logout,
  resetPassword,
  signup,
  verifyEmail,
} from "@/lib/auth-api";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth-cookie";

export type ActionState = {
  error?: string;
  success?: string;
  showUnverifiedModal?: boolean;
};

function getSafeNextPath(value: FormDataEntryValue | null) {
  const nextPath = typeof value === "string" ? value : "/";

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
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
    return {
      error: response.error,
      showUnverifiedModal: response.code === "UNVERIFIED_ACCOUNT",
    };
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

  revalidatePath("/");
  redirect("/verify-email-sent");
}

export async function verifyEmailAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "").trim();

  if (!token) {
    return { error: "Verification token is required" };
  }

  const response = await verifyEmail({ token });

  if (!response.ok) {
    return { error: response.error };
  }

  revalidatePath("/");
  redirect("/login");
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

  redirect("/login");
}

export async function changePasswordAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  const token = await getAuthToken();

  if (!token) {
    return { error: "You need to sign in again to change your password." };
  }

  const response = await changePassword(
    {
      current_password: currentPassword,
      new_password: newPassword,
    },
    token,
  );

  if (!response.ok) {
    return { error: response.error };
  }

  return { success: response.data.message };
}
