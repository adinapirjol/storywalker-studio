import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/xr/music-library/route';

const route = 'http://localhost:3000/api/xr/music-library';
const sample = 'acid-pressure-148';
let root: string;
let audio: string;

function request({ id = sample, asset = 'audio', headers = {} }: {
  id?: string;
  asset?: string;
  headers?: Record<string, string>;
} = {}) {
  const query = new URLSearchParams({ sample: id, asset });
  return new Request(`${route}?${query}`, {
    headers: { 'sec-fetch-site': 'same-origin', ...headers },
  });
}

beforeEach(() => {
  root = mkdtempSync(path.join(realpathSync(tmpdir()), 'storywalker-music-fixture-'));
  const directory = path.join(root, 'private-data', 'music-sketches', '2026-11-19-hard-acid-machine-original');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  audio = path.join(directory, 'acid-pressure-148bpm.wav');
  writeFileSync(audio, 'RIFFTEST', { mode: 0o600 });
  writeFileSync(path.join(directory, 'storywalker-hard-acid-148.py'), '# Fictional generator\n', { mode: 0o600 });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('local generated music library', () => {
  it('serves allowlisted files with the requested audio range and no caching', async () => {
    const response = await GET(request({ headers: { range: 'bytes=4-7' } }));
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 4-7/8');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).toBe('TEST');

    const source = await GET(request({ asset: 'source' }));
    expect(source.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await source.text()).toBe('# Fictional generator\n');
  });

  it('rejects foreign requests, unknown tracks, and unsatisfiable ranges', async () => {
    expect((await GET(request({ headers: { host: 'example.test' } }))).status).toBe(403);
    expect((await GET(request({ headers: { origin: 'null' } }))).status).toBe(403);
    expect((await GET(request({ headers: { 'sec-fetch-site': 'cross-site' } }))).status).toBe(403);
    expect((await GET(request({ id: '__proto__' }))).status).toBe(404);
    expect((await GET(request({ headers: { range: 'bytes=20-' } }))).status).toBe(416);
  });

  it('refuses broader file permissions and symbolic links', async () => {
    chmodSync(audio, 0o644);
    expect((await GET(request())).status).toBe(404);

    rmSync(audio);
    const otherFile = path.join(root, 'other.wav');
    writeFileSync(otherFile, 'RIFFOTHER', { mode: 0o600 });
    symlinkSync(otherFile, audio);
    expect((await GET(request())).status).toBe(404);
  });
});
