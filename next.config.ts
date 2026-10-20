import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep release verification separate from an open development preview.
  distDir:
    process.env.STORYWALKER_REVIEW_BUILD === "1" ? ".next-review" : ".next",
  poweredByHeader: false,
  // Preserve absolute redirects when changing loopback hostnames for passkeys.
  skipProxyUrlNormalize: true,
  // Local private inputs must never travel with server deployment traces.
  outputFileTracingExcludes: {
    "/*": [
      "./private-data/**/*",
      "./tmp/**/*",
      "./**/*.private.*",
      "./**/export.xml",
      "./**/export_cda.xml",
      "./**/export.zip",
      "./**/apple_health_export/**/*",
      "./**/health-exports/**/*",
      "./**/storywalker-health-*.txt",
      "./.env*",
      "./.logfire/**/*",
      "./.git/**/*",
      "./.next/**/*",
      "./.next-review/**/*",
    ],
  },
  // sql.js loads its SQLite WASM binary from disk on the server. Keeping it
  // external preserves the package-relative runtime path used by the Vault.
  serverExternalPackages: ["sql.js"],
};

export default nextConfig;
