/** Conservative CI selection. No network calls, dependencies, or cached results. */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const fullScope = () => ({ quality: true, actions: true, 'javascript-typescript': true, python: true, swift: true });

export function classifyPaths(paths) {
  // Actions analysis stays on: the CodeQL tool remains active even on docs PRs.
  const scope = { quality: false, actions: true, 'javascript-typescript': false, python: false, swift: false };
  for (const file of paths) {
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.split('/').includes('..')) return fullScope();
    if (['README.md', 'AGENTS.md', '.github/pull_request_template.md'].includes(file) || /^docs\/.*\.md$/.test(file)) continue;
    scope.quality = true;
    // Changes to the selector, workflows or cross-language contracts must check all lanes.
    if (file.startsWith('.github/') || file.startsWith('scripts/ci-scope') || /\.schema\.json$/.test(file)
      || /^(lib\/(native|health|context|body)\/|app\/api\/context-|research\/rehearsal-dramaturg\/dramaturg\/context\/models\.py$)/.test(file)) return fullScope();
    // A project can contain tooling in another language; retain that analysis too.
    if (/\.(?:[cm]?[jt]sx?)$/.test(file)) scope['javascript-typescript'] = true;
    if (/\.py$/.test(file)) scope.python = true;
    if (/\.swift$/.test(file)) scope.swift = true;
    if (file.startsWith('research/body-context-native/')) { scope.swift = true; continue; }
    if (file.startsWith('research/rehearsal-dramaturg/') || /\.py$/.test(file)) { scope.python = true; continue; }
    if (/\.(?:[cm]?[jt]sx?|css)$/.test(file) || ['package.json', 'package-lock.json', 'tsconfig.json'].includes(file)) {
      scope['javascript-typescript'] = true; continue;
    }
    // Includes assets, fixtures, lockfiles/config outside known projects and new languages.
    return fullScope();
  }
  return scope;
}

export function selectScope(eventName, event, diff) {
  if (eventName !== 'pull_request') return { scope: fullScope(), reason: 'Full checks for non-PR events.' };
  try {
    const base = event.pull_request?.base?.sha, head = event.pull_request?.head?.sha;
    if (![base, head].every(value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value))) throw new Error('Invalid revisions');
    const paths = diff(base, head);
    if (!Array.isArray(paths) || paths.length === 0) throw new Error('No reliable diff');
    return { scope: classifyPaths(paths), reason: 'Selected from the complete PR diff; required checks retain their names.' };
  } catch {
    return { scope: fullScope(), reason: 'Diff unavailable or uncertain; running all checks.' };
  }
}

export function changedPaths(base, head, cwd = process.cwd()) {
  // No rename detection: both the deleted and added path must contribute to scope.
  // NUL separation preserves spaces and newlines in Git filenames.
  const raw = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`, '--'],
    { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return raw.split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let event = {};
  try { event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* selectScope falls back to full checks. */ }
  const result = selectScope(process.env.GITHUB_EVENT_NAME, event, changedPaths);
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result.scope).map(([key, value]) => `${key}=${value}\n`).join(''));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Check selection\n\n${result.reason}\n\n${Object.entries(result.scope).map(([key, value]) => `- ${key}: ${value ? 'run' : 'not applicable'}`).join('\n')}\n`);
}
