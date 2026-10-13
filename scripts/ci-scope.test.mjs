import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { classifyPaths, fullScope, selectScope, changedPaths } from './ci-scope.mjs';

const event = { pull_request: { base: { sha: 'a'.repeat(40) }, head: { sha: 'b'.repeat(40) } } };
test('docs retain privacy/Actions checks without code lanes', () => {
  assert.deepEqual(classifyPaths(['README.md', 'AGENTS.md', 'docs/roadmap.md', '.github/pull_request_template.md']),
    { quality: false, actions: true, 'javascript-typescript': false, python: false, swift: false });
});
test('web Vault changes do not need native analysis', () => {
  const scope = classifyPaths(['lib/vault/vault-recovery.ts', 'app/api/vault/route.ts', 'docs/vault-passkeys.md']);
  assert.equal(scope.quality, true); assert.equal(scope['javascript-typescript'], true);
  assert.equal(scope.swift, false); assert.equal(scope.python, false);
});
test('native sources, build configuration and assets select Swift', () => {
  for (const file of ['Sources/CollectorCore/Queue.swift', 'Package.swift', 'project.yml', 'iPhone/Assets.xcassets/icon.png']) {
    const scope = classifyPaths([`research/body-context-native/${file}`]);
    assert.equal(scope.swift, true); assert.equal(scope.quality, true);
  }
});
test('Python dependencies and scripts select Python', () => {
  for (const file of ['research/rehearsal-dramaturg/uv.lock', 'scripts/tool.py']) assert.equal(classifyPaths([file]).python, true);
});
test('shared contracts, receiver code and CI changes select every lane', () => {
  for (const file of ['lib/native/native-transfer.schema.json', 'lib/native/native-receiver.ts', 'app/api/context-health/route.ts',
    'research/rehearsal-dramaturg/dramaturg/context/models.py', '.github/workflows/ci.yml', 'scripts/ci-scope.mjs', 'scripts/ci-scope.test.mjs']) {
    assert.deepEqual(classifyPaths([file]), fullScope());
  }
});
test('unknown paths, deletion names and new languages cannot silently opt out', () => {
  for (const file of ['new-project/main.rs', 'public/demo.json', 'docs/generated.mdx', '../unsafe', '']) assert.deepEqual(classifyPaths([file]), fullScope());
});
test('mixed PRs keep earlier code changes even if docs are added last', () => {
  const result = selectScope('pull_request', event, () => ['research/body-context-native/Package.swift', 'README.md']);
  assert.equal(result.scope.swift, true);
});
test('push, schedule, dispatch, unavailable or malformed diffs run everything', () => {
  for (const name of ['push', 'schedule', 'workflow_dispatch', undefined]) assert.deepEqual(selectScope(name, {}, () => []).scope, fullScope());
  for (const diff of [() => [], () => { throw new Error('Missing history'); }, () => null]) assert.deepEqual(selectScope('pull_request', event, diff).scope, fullScope());
  assert.deepEqual(selectScope('pull_request', {}, () => ['README.md']).scope, fullScope());
});
test('real Git comparison includes both renamed paths and changes before the latest commit', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'storywalker-ci-scope-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Fictional CI fixture'); git('config', 'user.email', 'fixture@example.invalid');
    mkdirSync(path.join(cwd, 'research/body-context-native'), { recursive: true });
    writeFileSync(path.join(cwd, 'research/body-context-native/example.swift'), 'fictional');
    git('add', '.'); git('commit', '-m', 'fixture base'); const base = git('rev-parse', 'HEAD');
    renameSync(path.join(cwd, 'research/body-context-native/example.swift'), path.join(cwd, 'README.md'));
    git('add', '-A'); git('commit', '-m', 'fixture rename');
    writeFileSync(path.join(cwd, 'AGENTS.md'), 'fictional'); git('add', '.'); git('commit', '-m', 'fixture docs');
    const paths = changedPaths(base, git('rev-parse', 'HEAD'), cwd);
    assert.ok(paths.includes('research/body-context-native/example.swift'));
    assert.ok(paths.includes('README.md')); assert.equal(classifyPaths(paths).swift, true);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('cross-language project tooling retains both language analyses', () => {
  assert.equal(classifyPaths(['research/body-context-native/generator.py']).python, true);
  assert.equal(classifyPaths(['research/body-context-native/generator.py']).swift, true);
  assert.equal(classifyPaths(['research/rehearsal-dramaturg/helper.ts'])['javascript-typescript'], true);
  assert.equal(classifyPaths(['research/rehearsal-dramaturg/helper.ts']).python, true);
});

// Execute the workflow's actual shell guard, including malformed output cases.
test('quality selection rejects missing or malformed output before conditional checks', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const guard = workflow.match(/ {6}- name: Validate quality selection\n([\s\S]*?)(?=\n {6}- name:)/)?.[1];
  assert.ok(guard, 'quality must validate selector output');
  const script = guard.split('        run: |\n')[1]?.split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');
  assert.ok(script, 'quality guard must have an executable shell block');
  for (const selected of ['true', 'false', '', 'TRUE', 'unknown', 'true\nfalse']) {
    const result = spawnSync('bash', ['-e', '-c', script], { env: { ...process.env, SELECTED: selected } });
    assert.equal(result.status === 0, ['true', 'false'].includes(selected), `output ${JSON.stringify(selected)}`);
  }
});
