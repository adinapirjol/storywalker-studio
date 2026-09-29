import type { Metadata } from "next";
import "./globals.css";
import {VaultAccess} from "@/components/vault-access";

export const metadata: Metadata = {
  title: "Storywalker Studio",
  description:
    "An author-controlled studio for correlating music history and life events while preserving uncertainty and privacy.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<VaultAccess /></body>
    </html>
  );
}
