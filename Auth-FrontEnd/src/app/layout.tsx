import type { Metadata } from "next";
import { JetBrains_Mono, Nunito } from "next/font/google";

import { AppNavbar } from "@/components/app-navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { getSessionData } from "@/lib/session";

import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Todo",
  description: "Next.js frontend for Auth REST API",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionData();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${nunito.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AppNavbar
            isAuthenticated={session.isAuthenticated}
            isAdmin={!!session.user?.isAdmin}
            userName={session.user?.name ?? null}
            dueTodayOpenTodoCount={session.isAuthenticated ? session.dueTodayOpenTodoCount : 0}
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
