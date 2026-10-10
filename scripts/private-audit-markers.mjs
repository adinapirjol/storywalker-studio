/** Local-only audit inputs. Fail closed without printing private paths or values. */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function privateAuditMarkers(root) {
  const present = path => {
    try { lstatSync(path); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  const markers = [];
  let bytes = 0;
  const checked = (path, directory = false) => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw Error();
    return stat;
  };
  const read = path => {
    const stat = checked(path);
    bytes += stat.size;
    if (stat.size > 16_000_000 || bytes > 64_000_000) throw Error();
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  try {
    // Existing recovery inputs are discovered without embedding personal filenames.
    const privateRoot = join(root, 'private-data');
    if (present(privateRoot)) checked(privateRoot, true);
    const directory = join(privateRoot, 'storywalker');
    if (present(directory)) {
      checked(directory, true);
      const entries = readdirSync(directory, { withFileTypes: true });
      if (entries.length > 1024) throw Error();
      const files = entries.filter(entry => entry.name.endsWith('.recovery.private.json'));
      if (files.length > 64) throw Error();
      for (const entry of files) {
        const value = read(join(directory, entry.name));
        if (!Array.isArray(value.moments ?? [])) throw Error();
        for (const moment of value.moments ?? []) {
          if (!Array.isArray(moment.provenance ?? [])) throw Error();
          markers.push(...[moment.id, moment.title, moment.authorStatement,
            ...(moment.provenance ?? []).flatMap(source => [source.chatTitle, source.shortExcerpt])]
            .filter(value => typeof value === 'string' && value.trim().length >= 24));
        }
      }
    }
    const credentials = join(root, '.logfire');
    if (present(credentials)) {
      checked(credentials, true);
      const health = join(credentials, 'storywalker');
      if (present(health)) checked(health, true);
      for (const path of [join(credentials, 'logfire_credentials.json'), join(health, 'logfire_credentials.json')]) {
        if (present(path)) {
          const token = read(path).token;
          if (typeof token !== 'string' || !token.length) throw Error();
          markers.push(token);
        }
      }
    }
    return [...new Set(markers)];
  } catch {
    throw Error('Local private audit inputs could not be safely read; audit stopped.');
  }
}
