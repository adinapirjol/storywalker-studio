import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, lstatSync } from "node:fs";
import { extname, join } from "node:path";

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
  /(^|\/)\.logfire(?:\/|$)/u,
  /(^|\/)\.env(?:\.[^/]*)?$/u,
  /(^|\/)(?:__pycache__|\.pytest_cache|\.build|xcuserdata)(?:\/|$)/u,
  /\.py[co]$/u,
  /(^|\/)private-spotify-exports\//u,
  /(^|\/)private-spotify-raw\//u,
  /(^|\/)private-google-timeline-raw\//u,
  /(^|\/)private-memories\//u,
  /(^|\/)private-storywalker-derivatives\//u,
  /(^|\/)exports\/private-inputs\//u,
  /(^|\/)exports\/[^/]+-seed-prep\//u,
  /\.private\.json$/u,
  /\.private\.(?:md|txt)$/u,
  /\.(?:local\.xcconfig|mobileprovision|provisionprofile|p12|p8)$/u,
  /(^|\/)storywalker-private-/u,
];

const stagedRecoveryPath = join(root, "private-data", "storywalker", "july-august-2026.recovery.private.json");
const privateMarkers = existsSync(stagedRecoveryPath)
  ? (() => {
    try {
      const recovery = JSON.parse(readFileSync(stagedRecoveryPath, "utf8"));
      return [
        ...(recovery.moments ?? []).flatMap((moment) => [moment.id, moment.title, moment.authorStatement, ...(moment.provenance ?? []).flatMap((source) => [source.chatTitle, source.shortExcerpt])]),
        ...(recovery.companions ? [] : []),
      ].filter((value) => typeof value === "string" && value.trim().length >= 24);
    } catch { failures.push("local private recovery guard could not be read"); return []; }
  })()
  : [];
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
  ".py", ".swift", ".pbxproj", ".plist", ".entitlements", ".xcscheme", ".xcworkspacedata", ".xcconfig", ".toml", ".env", ".xml",
]);

for (const file of listed) {
  if (file !== ".env.example" && forbiddenTrackedPaths.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: forbidden private or credential path`);
  }
  if (forbiddenArtifactNames.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: known private artifact filename`);
  }
  if (!existsSync(file)) continue; // tracked deletions have no remaining content
  if (lstatSync(file).isSymbolicLink()) { failures.push(`${file}: committable symlink requires explicit review`); continue; }
  if (!textExtensions.has(extname(file))) continue;
  if (statSync(file).size > 2_000_000) { failures.push(`${file}: large text input needs explicit privacy review`); continue; }
  const source = readFileSync(file, "utf8");
  if (extname(file) === ".xml" && /<HealthData(?:\s|>)/u.test(source)) failures.push(`${file}: raw Apple Health export in a committable path`);
  if (/\/Users\//u.test(source)) {
    failures.push(`${file}: absolute user path`);
  }
  if (file !== "scripts/audit-public-repo.mjs") {
    if (/\b(?:Cluj(?:-Napoca)?|Electric Castle|Florian[oó]polis|Sziget|Ronqui[eè]res|Tom Misch|Fat Mama|Incubus)\b/iu.test(source)) {
      failures.push(`${file}: private-journey or Romanian-specific reference`);
    }
    if (/open\.spotify\.com\/playlist\/[^\s?]+\?(?:[^\s#]*&)?(?:si|pt)=/iu.test(source)) {
      failures.push(`${file}: Spotify share-link parameter`);
    }
  }
  if (privateMarkers.some((marker) => source.includes(marker))) {
    failures.push(`${file}: private recovery marker copied into a committable file`);
  }
  if (/(?:sk-|gh[pousr]_|github_pat_|glpat-)[A-Za-z0-9_-]{20,}/u.test(source)) {
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
    `Public repository audit passed: ${listed.length} visible file(s), no forbidden paths, absolute user paths, private journey markers, or credential values found${privateMarkers.length ? "; staged private marker guard checked" : ""}.`,
  );
}
