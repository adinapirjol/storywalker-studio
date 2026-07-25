import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const root = process.cwd();
const listed = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .sort();

const failures = [];
const forbiddenTrackedPaths = [
  /(^|\/)\.spotify-token\.local\.json$/u,
  /(^|\/)private-data\//u,
  /(^|\/)private-spotify-exports\//u,
  /(^|\/)exports\/private-inputs\//u,
  /(^|\/)exports\/[^/]+-seed-prep\//u,
  /\.private\.json$/u,
];
const forbiddenArtifactNames = [
  /^exports\/storywalker-life-timeline-/u,
  /^exports\/florianopolis-/u,
];
const textExtensions = new Set([
  "",
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

for (const file of listed) {
  if (forbiddenTrackedPaths.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: forbidden private or credential path`);
  }
  if (forbiddenArtifactNames.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: known private artifact filename`);
  }
  if (!textExtensions.has(extname(file)) || statSync(file).size > 2_000_000) continue;
  const source = readFileSync(file, "utf8");
  if (/\/Users\//u.test(source)) {
    failures.push(`${file}: absolute user path`);
  }
  if (file !== "scripts/audit-public-repo.mjs") {
    if (/\b(?:Cluj(?:-Napoca)?|Bucharest|Romania|Electric Castle|Florianopolis)\b/iu.test(source)) {
      failures.push(`${file}: private-journey or Romanian-specific reference`);
    }
  }
  if (/(?:sk|ghp|glpat)-[A-Za-z0-9_-]{20,}/u.test(source)) {
    failures.push(`${file}: token-like credential value`);
  }
  if (/SPOTIFY_CLIENT_SECRET[ \t]*=[ \t]*[^\s"']+/u.test(source) && file !== ".env.example") {
    failures.push(`${file}: non-empty Spotify client secret assignment`);
  }
  if (/"(?:access_token|refresh_token|client_secret)"\s*:\s*"[^"]+"/u.test(source)) {
    failures.push(`${file}: serialized credential-like value`);
  }
}

const privateGitObjects = listed.filter((file) => file === ".git" || file.startsWith(".git/"));
if (privateGitObjects.length) failures.push("inherited .git content appears in the public file list");

if (failures.length) {
  console.error(`Public repository audit failed (${failures.length} finding(s)):\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Public repository audit passed: ${listed.length} visible file(s), no forbidden paths, absolute user paths, private journey markers, or credential values found.`,
  );
}
