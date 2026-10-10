import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const buildDirectory = process.env.STORYWALKER_REVIEW_BUILD === "1" ? ".next-review" : ".next";
const root = join(process.cwd(), buildDirectory, "static");
if (!existsSync(root)) throw new Error("No production build found. Run npm run build before npm run audit:build-private.");
const files = [];
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) visit(join(directory, entry.name));
    else files.push(join(directory, entry.name));
  }
}
visit(root);
// Public prerendered HTML/RSC is also a browser artifact; server source chunks are not.
const prerender=join(process.cwd(),buildDirectory,"server","app");
if(existsSync(prerender)) {
  const before=files.length;visit(prerender);
  const publicFiles=files.splice(before).filter(file=>/\.(?:html|rsc)$/u.test(file));files.push(...publicFiles);
}
const markers=[];
const recovery=join(process.cwd(),"private-data","storywalker","july-august-2026.recovery.private.json");
if(existsSync(recovery)) {
  const value=JSON.parse(readFileSync(recovery,"utf8"));
  markers.push(...(value.moments??[]).flatMap(m=>[m.id,m.title,m.authorStatement]));
}
for(const credential of [join(process.cwd(),".logfire","logfire_credentials.json"),join(process.cwd(),".logfire","storywalker","logfire_credentials.json")]) {
 if(existsSync(credential))markers.push(JSON.parse(readFileSync(credential,"utf8")).token);
}
const sensitive=markers.filter(value=>typeof value==="string"&&value.length>=24);
const forbidden = [/ip_addr/iu, /user_agent/iu, /private-google-timeline-raw/iu, /private-spotify-raw/iu, /raw private exports/iu, /july-august-2026\.recovery\.private/iu, /open\.spotify\.com\/[^\s"']+\?(?:[^\s"']*&)?(?:si|pt)=/iu];
const failures = files.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  if(sensitive.some(marker=>text.includes(marker)))return [`${file.replace(process.cwd()+"/", "")}: local private marker or credential found`];
  return forbidden.filter((pattern) => pattern.test(text)).map((pattern) => `${file.replace(process.cwd() + "/", "")}: ${pattern}`);
});
if (failures.length) throw new Error(`Private build audit failed:\n${failures.join("\n")}`);
console.log(`Private build audit passed: ${files.length} public client/prerender artifact(s), no raw private fields, local private markers, credential values or Spotify share tokens.`);
