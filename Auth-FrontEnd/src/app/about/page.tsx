import Image from "next/image";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionData } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const session = await getSessionData();

  if (!session.isAuthenticated || !session.user) {
    redirect("/login?next=/about");
  }

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col justify-center gap-4 overflow-hidden px-6 py-12">
      <Image
        src="/appLogo.png"
        alt=""
        width={220}
        height={220}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 w-24 opacity-90 sm:right-6 sm:top-6 sm:w-32"
        priority
      />

      <Card className="w-full">
        <CardHeader>
          <CardTitle>About your session</CardTitle>
          <CardDescription>
            Authenticated user and active session details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Name:</span> {session.user.name}
            </p>
            <p>
              <span className="font-medium">Email:</span> {session.user.email}
            </p>
            <p>
              <span className="font-medium">User ID:</span> {session.user.id}
            </p>
            <p>
              <span className="font-medium">Verified:</span>{" "}
              {session.user.isVerified ? "Yes" : "No"}
            </p>
          </section>

          <section className="space-y-2 text-sm">
            <h2 className="font-medium">Active Sessions</h2>
            {session.sessions.length === 0 ? (
              <p className="text-muted-foreground">No active sessions found.</p>
            ) : (
              <ul className="space-y-3">
                {session.sessions.map((activeSession) => (
                  <li key={activeSession.id} className="rounded-md border p-3">
                    <p>
                      <span className="font-medium">Session:</span>{" "}
                      {activeSession.id}
                    </p>
                    <p>
                      <span className="font-medium">Current:</span>{" "}
                      {activeSession.is_current ? "Yes" : "No"}
                    </p>
                    <p>
                      <span className="font-medium">Created:</span>{" "}
                      {activeSession.created_at}
                    </p>
                    <p>
                      <span className="font-medium">Expires:</span>{" "}
                      {activeSession.expires_at}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
