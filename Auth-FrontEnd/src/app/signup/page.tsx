import Link from "next/link";
import { CloudCog, LockKeyhole, MailCheck, UserX } from "lucide-react";

import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const registrationOpen = process.env.REGISTRATION_OPEN !== "false";


export default function SignupPage() {
  console.log("Registration open:", registrationOpen);
  if (!registrationOpen) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-12">
        {/* Icon cluster */}
        <div className="relative flex items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 ring-4 ring-blue-100 dark:ring-blue-900/50">
            <LockKeyhole className="h-12 w-12 text-blue-500" strokeWidth={1.5} />
          </div>
          <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60 ring-2 ring-white dark:ring-background">
            <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </span>
        </div>

        {/* Card */}
        <Card className="w-full border-blue-200/70 shadow-sm dark:border-blue-900/40">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl tracking-tight">
              Invite Only
            </CardTitle>
            <CardDescription className="text-base">
              Registration is currently closed to the public.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-muted-foreground dark:border-blue-900/40 dark:bg-blue-950/20">
              <p>
                This service is available <strong className="text-foreground">by invitation only</strong>.
                If you&apos;ve received an invite, please check your email for
                a direct access link.
              </p>
            </div>

            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <MailCheck className="h-5 w-5 text-blue-400" />
              <span>Already have an account?</span>
            </div>

            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-500 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </main>
  );
}
