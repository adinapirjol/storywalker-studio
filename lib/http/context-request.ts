/** Count bytes before decoding. The request owns the reader and its cancellation. */
export async function boundedText(request: Request, limit: number): Promise<string> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("invalid_request_limit");
  request.signal.throwIfAborted();
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  const abort = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    request.signal.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      request.signal.throwIfAborted();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("request_limit");
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
