import type { Metadata } from "next";

// page.tsx is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Verify Email",
};

export default function VerifyEmailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
