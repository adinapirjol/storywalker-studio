/**
 * Fail a CodeQL analysis lane on high/critical security findings or error-severity
 * findings. Inspect the real SARIF created by CodeQL; never invent a clean scan.
 * Each lane runs this only if CodeQL actually analyzed that language.
 */
import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function blockingFindings(sarif) {
  if (sarif?.version !== '2.1.0' || !Array.isArray(sarif.runs) || sarif.runs.length === 0) {
    throw new Error('Invalid or empty SARIF analysis document');
  }
  const findings = [];
  for (const run of sarif.runs) {
    if (run?.tool?.driver?.name !== 'CodeQL' || !Array.isArray(run.results)) {
      throw new Error('Expected a real CodeQL SARIF run with results');
    }
    const rules = run.tool.driver.rules ?? [];
    for (const result of run.results) {
      if (result.kind === 'notApplicable' || result.kind === 'pass') continue;
      const rule = result.ruleIndex !== undefined
        ? rules[result.ruleIndex]
        : rules.find((item) => item.id === result.ruleId);
      if (!rule) throw new Error('A CodeQL result has no matching rule');
      const properties = { ...rule.properties, ...result.properties };
      const rawScore = properties['security-severity'];
      const score = rawScore == null ? null : Number(rawScore);
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10)) {
        throw new Error('Invalid security severity in CodeQL results');
      }
      const problemSeverity = properties['problem.severity'];
      const level = result.level ?? rule.defaultConfiguration?.level;
      if (score !== null && score >= 7 || problemSeverity === 'error' || level === 'error') {
        findings.push({
          rule: result.ruleId ?? rule.id,
          severity: score !== null && score >= 7 ? (score >= 9 ? 'critical' : 'high') : 'error',
          path: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? '(unknown file)',
        });
      }
    }
  }
  return findings;
}

export function sarifFiles(location) {
  const directory = resolve(location);
  if (!statSync(directory).isDirectory()) throw new Error('Expected SARIF output directory');
  const files = [];
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(path, entry.name));
      else if (entry.isFile() && entry.name.endsWith('.sarif')) files.push(join(path, entry.name));
    }
  }
  walk(directory);
  if (files.length === 0) throw new Error('CodeQL produced no SARIF results');
  return files;
}

export function evaluateDirectory(location) {
  const files = sarifFiles(location);
  const findings = files.flatMap((file) => blockingFindings(JSON.parse(readFileSync(file, 'utf8'))));
  return { files: files.length, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Provide the CodeQL SARIF output directory');
    const { files, findings } = evaluateDirectory(process.argv[2]);
    const message = findings.length
      ? `BLOCKED: ${findings.length} high/critical or error-severity CodeQL finding(s) in ${files} SARIF file(s).`
      : `PASS: No high/critical or error-severity CodeQL findings in ${files} SARIF file(s).`;
    console.log(message);
    for (const finding of findings) console.error(`${finding.severity}: ${finding.rule} in ${finding.path}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `### CodeQL severity gate\n\n${message}\n\n`
        + findings.map(({ severity, rule, path }) => `- ${severity}: \`${rule}\` in \`${path}\`\n`).join(''));
    }
    if (findings.length) process.exitCode = 1;
  } catch (error) {
    console.error(`CodeQL severity gate could not verify scan results: ${error.message}`);
    process.exitCode = 1; // Fail closed on missing, unreadable, or invalid SARIF.
  }
}
