/** Next may normalize request.url to localhost while the browser uses 127.0.0.1.
 * Match the browser Origin to the actual loopback Host, including its port.
 * Never trust forwarded headers or accept an arbitrary hostname for Vault access.
 */
export function isLocalSameOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get('origin');
    if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
    const source = new URL(origin);
    const target = new URL(request.url);
    const host = request.headers.get('host') ?? target.host;
    return origin === source.origin && source.protocol === target.protocol &&
      ['http:', 'https:'].includes(source.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) && source.host === host;
  } catch { return false; }
}

/** GETs normally have no Origin. Still reject foreign Host and browser sites. */
export function isLocalRead(request: Request): boolean {
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
    if (request.headers.has('origin')) return isLocalSameOrigin(request);
    const target = new URL(request.url);
    const host = request.headers.get('host') ?? target.host;
    const local = new URL(`${target.protocol}//${host}`);
    return ['http:', 'https:'].includes(target.protocol) && local.host === host &&
      ['localhost', '127.0.0.1', '[::1]'].includes(local.hostname);
  } catch { return false; }
}
