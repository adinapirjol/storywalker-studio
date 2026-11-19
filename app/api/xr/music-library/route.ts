import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isLocalRead } from '@/lib/http/local-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const library = {
  'noise-era-rhythm-132': {
    directory: '2026-10-19-noise-era-01',
    audio: 'NOISE-ERA-rhythm-sketch-132bpm.wav',
    source: 'storywalker-noise-rhythm.original.py',
  },
  'acid-pressure-148': {
    directory: '2026-11-19-hard-acid-machine-original',
    audio: 'acid-pressure-148bpm.wav',
    source: 'storywalker-hard-acid-148.py',
  },
  'acid-pressure-industrial-v4': {
    directory: '2026-11-19-hard-acid-machine-original',
    audio: 'acid-pressure-148bpm-industrial-v4.wav',
    source: 'storywalker-hard-acid-148-industrial-v4.py',
  },
  'acid-pressure-warehouse-v3': {
    directory: '2026-11-19-hard-acid-machine-original',
    audio: 'acid-pressure-148bpm-warehouse-v3.wav',
    source: 'storywalker-hard-acid-148-warehouse-v3.py',
  },
  'acid-pressure-reverb-v2': {
    directory: '2026-11-19-hard-acid-machine-original',
    audio: 'acid-pressure-148bpm-reverb-v2.wav',
    source: 'storywalker-hard-acid-148-reverb-v2.py',
  },
  'acid-pressure-concrete-room-v1': {
    directory: '2026-11-19-hard-acid-machine-original',
    audio: 'acid-pressure-148bpm-concrete-room-v1.wav',
    source: 'storywalker-hard-acid-148-concrete-room-v1.py',
  },
} as const;

function unavailable(status: number) {
  return new Response('Local music item unavailable.', {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Serves only the curated source-free sketches to the loopback Storywalker UI. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isLocalRead(request) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || (!request.headers.has('origin') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
    return unavailable(403);
  }

  const id = url.searchParams.get('sample') ?? '';
  const asset = url.searchParams.get('asset');
  if (!Object.hasOwn(library, id) || (asset !== 'audio' && asset !== 'source')) return unavailable(404);
  const entry = library[id as keyof typeof library];

  try {
    const root = path.resolve(process.cwd(), 'private-data', 'music-sketches');
    const filename = asset === 'audio' ? entry.audio : entry.source;
    const target = path.resolve(root, entry.directory, filename);
    if (!target.startsWith(root + path.sep) || await realpath(target) !== target) return unavailable(404);
    const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      const maxBytes = asset === 'audio' ? 16 * 1024 * 1024 : 40_000;
      if (!stat.isFile() || stat.nlink !== 1 || stat.size === 0 || stat.size > maxBytes
        || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) return unavailable(404);
      return await readAsset(file, stat.size, asset, request.headers.get('range'));
    } finally {
      await file.close();
    }
  } catch {
    return unavailable(404);
  }
}

async function readAsset(file: Awaited<ReturnType<typeof open>>, size: number, asset: 'audio' | 'source', range: string | null) {
  const headers = new Headers({
    'Content-Type': asset === 'audio' ? 'audio/wav' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Accept-Ranges': asset === 'audio' ? 'bytes' : 'none',
  });

  const partial = asset === 'audio' && Boolean(range);
  let start = 0;
  let end = size - 1;
  if (partial) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
    const first = match?.[1];
    const last = match?.[2];
    const valid = Boolean(first || last) && Number.isSafeInteger(Number(first)) && Number.isSafeInteger(Number(last));
    if (valid) {
      if (first) {
        start = Number(first);
        if (last) end = Math.min(end, Number(last));
      } else {
        start = Math.max(0, size - Number(last));
      }
    }
    if (!valid || start > end) {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }

  const bytes = new Uint8Array(end - start + 1);
  let offset = 0;
  while (offset < bytes.length) {
    const result = await file.read(bytes, offset, bytes.length - offset, start + offset);
    if (!result.bytesRead) return unavailable(404);
    offset += result.bytesRead;
  }
  headers.set('Content-Length', String(bytes.length));
  return new Response(bytes, { status: partial ? 206 : 200, headers });
}
