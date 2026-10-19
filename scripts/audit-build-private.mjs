import { privateAuditMarkers } from "./private-audit-markers.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";

const buildDirectory =
  process.env.STORYWALKER_REVIEW_BUILD === "1" ? ".next-review" : ".next";
const buildRoot = process.env.STORYWALKER_AUDIT_BUILD_ROOT || process.cwd();
const root = join(buildRoot, buildDirectory, "static");
if (!existsSync(root))
  throw new Error(
    "No production build found. Run npm run build before npm run audit:build-private.",
  );
const files = [];
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) visit(join(directory, entry.name));
    else files.push(join(directory, entry.name));
  }
}
visit(root);
// Public prerendered HTML/RSC is also a browser artifact; server source chunks are not.
const prerender = join(buildRoot, buildDirectory, "server", "app");
if (existsSync(prerender)) {
  const before = files.length;
  visit(prerender);
  const publicFiles = files
    .splice(before)
    .filter((file) => /\.(?:html|rsc)$/u.test(file));
  files.push(...publicFiles);
}
const sensitive = privateAuditMarkers(process.cwd());
const forbidden = [
  /ip_addr/iu,
  /user_agent/iu,
  /private-google-timeline-raw/iu,
  /private-spotify-raw/iu,
  /raw private exports/iu,
  /[A-Za-z0-9_-]+\.recovery\.private/iu,
  /open\.spotify\.com\/[^\s"']+\?(?:[^\s"']*&)?(?:si|pt)=/iu,
];
const failures = files.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  if (sensitive.some((marker) => text.includes(marker)))
    return [
      `${file.replace(process.cwd() + "/", "")}: local private marker or credential found`,
    ];
  return forbidden
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `${file.replace(process.cwd() + "/", "")}: ${pattern}`);
});
if (failures.length)
  throw new Error(`Private build audit failed:\n${failures.join("\n")}`);
console.log(
  `Private build audit passed: ${files.length} public client/prerender artifact(s), no raw private fields, local private markers, credential values or Spotify share tokens.`,
);

// Deployment manifests are artifacts too: Git-ignore does not protect them.
const manifests = [];
function collectTraces(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectTraces(path);
    else if (entry.name.endsWith(".nft.json")) manifests.push(path);
  }
}
collectTraces(join(buildRoot, buildDirectory));
let privateTraceCount = 0;
for (const manifest of manifests) {
  const trace = JSON.parse(readFileSync(manifest, "utf8"));
  for (const file of trace.files ?? []) {
    const path = relative(
      buildRoot,
      resolve(dirname(manifest), file),
    ).replaceAll("\\", "/");
    if (
      /(^|\/)(?:private-data|health-exports|apple_health_export|\.logfire|\.git)(?:\/|$)|(?:^|\/)export(?:_cda)?\.(?:xml|zip)$|\.private\.|(?:^|\/)\.env(?:[./]|$)|(?:^|\/)storywalker-health-[^/]*\.txt$/u.test(
        path,
      )
    )
      privateTraceCount++;
  }
}
if (privateTraceCount)
  throw new Error(
    "Private build audit failed: private inputs are referenced by deployment manifests. Paths and values withheld.",
  );
console.log(
  `Deployment trace audit passed: ${manifests.length} manifests contain no private input references.`,
);
