import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DRAFT_ROOTS = [
  path.join(process.cwd(), "private-data", "public-voice", "drafts"),
  path.join(process.cwd(), "private-data", "storywalker", "public-voice", "drafts"),
] as const;
const MAX_CANDIDATES = 32;
const MAX_FILE_BYTES = 250_000;

export type PrivateEditorialCandidate = { id: string; label: string; modifiedAt: string; bytes: number };
type CandidateFile = PrivateEditorialCandidate & { filename: string };

function candidateId(rootDirectory: string, relativePath: string) { return createHash("sha256").update(`${rootDirectory}:${relativePath}`).digest("hex").slice(0, 24); }
function safeRelativePath(candidate: string, rootDirectory: string) {
  const resolved = path.resolve(rootDirectory, candidate);
  const root = `${path.resolve(rootDirectory)}${path.sep}`;
  if (!resolved.startsWith(root)) throw new Error("That draft candidate is outside the private editorial-drafts folder.");
  return path.relative(rootDirectory, resolved);
}
function entries(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return entries(target);
    return entry.isFile() && /\.md$/iu.test(entry.name) ? [target] : [];
  });
}

/** Candidate discovery reads filenames and file metadata only. Draft contents
 * remain untouched until the Author selects one and confirms encryption. */
function candidateFiles(rootDirectories: readonly string[] = DRAFT_ROOTS): CandidateFile[] {
  return rootDirectories.flatMap((rootDirectory, rootIndex) => entries(rootDirectory).map((filename) => {
    const relativePath = safeRelativePath(path.relative(rootDirectory, filename), rootDirectory); const stats = statSync(filename);
    const prefix = rootIndex === 0 ? "public-voice/drafts" : "storywalker/public-voice/drafts";
    return { id: candidateId(rootDirectory, relativePath), label: `${prefix}/${relativePath}`, modifiedAt: stats.mtime.toISOString(), bytes: stats.size, filename };
  })).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.label.localeCompare(b.label)).slice(0, MAX_CANDIDATES);
}

export function privateEditorialCandidates(rootDirectories: readonly string[] = DRAFT_ROOTS): PrivateEditorialCandidate[] {
  return candidateFiles(rootDirectories).map(({ filename: _filename, ...candidate }) => candidate);
}

export function readPrivateEditorialCandidate(id: string, rootDirectories: readonly string[] = DRAFT_ROOTS) {
  const selected = candidateFiles(rootDirectories).find((item) => item.id === id);
  if (!selected) throw new Error("That editorial draft candidate is no longer available. Refresh the Vault list and choose it again.");
  if (selected.bytes > MAX_FILE_BYTES) throw new Error("Choose an editorial draft smaller than 250 KB.");
  const { filename, ...candidate } = selected; const markdown = readFileSync(filename, "utf8");
  return { candidate, markdown };
}
