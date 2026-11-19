import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { blockingFindings, evaluateDirectory } from './check-codeql-sarif.mjs';

function sample({ score, problemSeverity, level = 'warning' } = {}) {
  return {
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'CodeQL', rules: [{
        id: 'test/rule',
        properties: {
          ...(score === undefined ? {} : { 'security-severity': score }),
          ...(problemSeverity === undefined ? {} : { 'problem.severity': problemSeverity }),
        },
        defaultConfiguration: { level },
      }] } },
      results: [{ ruleId: 'test/rule', ruleIndex: 0, locations: [{
        physicalLocation: { artifactLocation: { uri: 'test.ts' } },
      }] }],
    }],
  };
}

test('critical and high security findings block', () => {
  for (const score of [7, 7.5, 8.9, 9, 10]) {
    assert.equal(blockingFindings(sample({ score })).length, 1);
  }
});
test('medium and low severity do not block', () => {
  for (const score of [0, 3.9, 4, 6.9]) {
    assert.deepEqual(blockingFindings(sample({ score })), []);
  }
});
test('error-severity non-security findings block', () => {
  assert.equal(blockingFindings(sample({ problemSeverity: 'error' })).length, 1);
  assert.equal(blockingFindings(sample({ level: 'error' })).length, 1);
  assert.deepEqual(blockingFindings(sample({ problemSeverity: 'warning' })), []);
});
test('results with unknown or malformed severity fail closed', () => {
  assert.throws(() => blockingFindings(sample({ score: 'unknown' })), /Invalid security severity/);
  assert.throws(() => blockingFindings({ version: '2.1.0', runs: [] }), /Invalid or empty/);
  assert.throws(() => blockingFindings(sample({ score: -1 })), /Invalid security severity/);
});
test('the gate requires a real SARIF file and checks its findings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'codeql-gate-'));
  try {
    assert.throws(() => evaluateDirectory(dir), /no SARIF/);
    writeFileSync(join(dir, 'javascript.sarif'), JSON.stringify(sample({ score: 7.4 })));
    assert.equal(evaluateDirectory(dir).files, 1);
    assert.equal(evaluateDirectory(dir).findings.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
