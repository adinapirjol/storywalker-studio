import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "static");
if (!existsSync(root)) throw new Error("No production build found. Run npm run build before npm run audit:build-private.");
const files = [];
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) visit(join(directory, entry.name));
    else files.push(join(directory, entry.name));
  }
}
visit(root);
const forbidden = [/ip_addr/iu, /user_agent/iu, /private-google-timeline-raw/iu, /private-spotify-raw/iu, /raw private exports/iu, /july-august-2026\.recovery\.private/iu, /open\.spotify\.com\/[^\s"']+\?(?:[^\s"']*&)?(?:si|pt)=/iu];
const failures = files.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return forbidden.filter((pattern) => pattern.test(text)).map((pattern) => `${file.replace(process.cwd() + "/", "")}: ${pattern}`);
});
if (failures.length) throw new Error(`Private build audit failed:\n${failures.join("\n")}`);
console.log(`Private build audit passed: ${files.length} client artifact(s), no raw private fields or Spotify share tokens.`);
