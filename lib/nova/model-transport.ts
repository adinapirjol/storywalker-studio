import { modelOutputSchema, type ModelPreview } from "./model-contract";

export class ModelConfigurationError extends Error {}

/** Fixed provider, no tools, no retry, no logging of provider responses. */
export async function requestModel(body: ModelPreview["body"], apiKey: string, signal: AbortSignal) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), redirect: "error",
  });
  if (!response.body) throw new Error(`MODEL_UNAVAILABLE_HTTP_${response.status}`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > (response.ok ? 262144 : 32768)) { await reader.cancel(); throw new Error("MODEL_OVERSIZE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (!response.ok) {
    let code: unknown, type: unknown;
    try {
      const error = JSON.parse(new TextDecoder().decode(bytes))?.error;
      code = error?.code; type = error?.type;
    } catch { /* Never surface raw provider messages. */ }
    if (response.status === 429 && (code === "credit_balance_exhausted" || code === "insufficient_quota" || type === "insufficient_quota")) throw new ModelConfigurationError("The configured OpenAI API account has no available credit or quota. Your observation is saved; restore API billing before preparing another request.");
    if (response.status === 401) throw new ModelConfigurationError("OpenAI did not accept the configured API credential. Your observation is saved; check the local API configuration.");
    throw new Error(`MODEL_UNAVAILABLE_HTTP_${response.status}`);
  }
  const result = JSON.parse(new TextDecoder().decode(bytes)) as {
    status?: string; output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
  };
  if (result.status !== "completed") throw new Error("MODEL_INCOMPLETE");
  const content = (result.output ?? []).filter(o => o.type === "message").flatMap(o => o.content ?? []);
  if (content.some(c => c.type === "refusal")) throw new Error("MODEL_REFUSAL");
  return modelOutputSchema.parse(JSON.parse(content.filter(c => c.type === "output_text").map(c => c.text ?? "").join("")));
}
