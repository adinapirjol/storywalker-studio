import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
