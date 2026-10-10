import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep release verification separate from an open development preview.
  distDir: process.env.STORYWALKER_REVIEW_BUILD === "1" ? ".next-review" : ".next",
  poweredByHeader: false,
  // sql.js loads its SQLite WASM binary from disk on the server. Keeping it
  // external preserves the package-relative runtime path used by the Vault.
  serverExternalPackages: ["sql.js"],
};

export default nextConfig;
