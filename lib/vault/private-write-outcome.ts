/** Content-free acknowledgement when authority or confirmation ends after a write. */
export class PrivateWriteCommittedError extends Error {
  constructor() { super('PRIVATE_WRITE_COMMITTED_RELOAD'); }
}
export function privateWriteCommittedResponse() {
  return Response.json({ code: 'PRIVATE_WRITE_COMMITTED_RELOAD', saved: true,
    error: 'Your change was saved, but its final confirmation could not finish. Unlock and reload before making another change.' },
  { status: 409, headers: { 'Cache-Control': 'no-store' } });
}
