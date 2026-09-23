import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mainstream House Manager",
  description: "Private workspace for Mainstream House leads, projects, and tasks.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
