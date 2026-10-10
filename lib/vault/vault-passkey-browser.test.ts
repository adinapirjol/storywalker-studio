import { afterEach, expect, it, vi } from "vitest";
import { authenticateVaultPasskey, passkeyError } from "./vault-passkey-browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";

const options: PublicKeyCredentialRequestOptionsJSON = {
  challenge: "AQ", rpId: "localhost", userVerification: "required", timeout: 120_000,
  hints: ["client-device", "hybrid", "security-key"], allowCredentials: [{ id: "AQ", type: "public-key" }],
};
function device(first?: ArrayBuffer) {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("PublicKeyCredential", class {});
  const credential = {
    id: "AQ", rawId: new Uint8Array([1]).buffer, authenticatorAttachment: "cross-platform",
    response: { clientDataJSON: new ArrayBuffer(1), authenticatorData: new ArrayBuffer(1), signature: new ArrayBuffer(1) },
    getClientExtensionResults: () => ({ prf: first ? { results: { first } } : {} }),
  };
  const get = vi.fn<(options: CredentialRequestOptions) => Promise<unknown>>().mockResolvedValue(credential);
  vi.stubGlobal("navigator", { credentials: { get } });
  return { get, credential };
}
afterEach(() => vi.unstubAllGlobals());

it("preserves required verification, platform preference and cross-device eligibility without biometric fields", async () => {
  const first = new ArrayBuffer(32); new Uint8Array(first).fill(7);
  const { get } = device(first);
  const controller = new AbortController();
  const result = await authenticateVaultPasskey(options, "AQ", controller.signal);
  expect(get).toHaveBeenCalledOnce();
  expect(get.mock.calls[0][0]).toMatchObject({ signal: controller.signal, publicKey: {
    rpId: "localhost", userVerification: "required", timeout: 120_000,
    hints: ["client-device", "hybrid", "security-key"],
    allowCredentials: [{ id: new Uint8Array([1]), type: "public-key" }],
    extensions: { prf: { eval: { first: new Uint8Array([1]) } } },
  } });
  expect(get.mock.calls[0][0].publicKey?.allowCredentials?.[0].transports).toBeUndefined();
  expect(Object.keys(result).sort()).toEqual(["prf", "response"]);
  expect(result.response.clientExtensionResults).toEqual({});
  expect(result.prf).toHaveLength(43);
  expect([...new Uint8Array(first)].every((value) => value === 0)).toBe(true);
});

it.each([undefined, 0, 31, 33])("fails closed for unsupported or wrong-sized PRF (%s), preserving recovery guidance", async (size) => {
  const first = size === undefined ? undefined : new ArrayBuffer(size);
  if (first) new Uint8Array(first).fill(7);
  const { get } = device(first);
  await expect(authenticateVaultPasskey(options, "AQ")).rejects.toThrow("Your passphrase still works");
  expect(get).toHaveBeenCalledOnce();
  if (first) expect([...new Uint8Array(first)].every((value) => value === 0)).toBe(true);
});

it.each(["NotAllowedError", "AbortError"])("does not retry a cancelled/rejected device prompt (%s)", async (name) => {
  const { get } = device();
  const error = new DOMException("Device prompt ended", name);
  get.mockRejectedValue(error);
  await expect(authenticateVaultPasskey(options, "AQ")).rejects.toBe(error);
  expect(get).toHaveBeenCalledOnce();
  expect(passkeyError(error)).toContain("cancelled or timed out");
});

it("discards and erases a late result after cancellation", async () => {
  const first = new ArrayBuffer(32); new Uint8Array(first).fill(7);
  const { get, credential } = device(first);
  const controller = new AbortController();
  get.mockImplementation(async () => { controller.abort(); return credential; });
  await expect(authenticateVaultPasskey(options, "AQ", controller.signal)).rejects.toThrow();
  expect(get).toHaveBeenCalledOnce();
  expect([...new Uint8Array(first)].every((value) => value === 0)).toBe(true);
});

it("rejects an insecure context before requesting authentication", async () => {
  const { get } = device();
  vi.stubGlobal("window", { isSecureContext: false });
  await expect(authenticateVaultPasskey(options, "AQ")).rejects.toThrow("unavailable");
  expect(get).not.toHaveBeenCalled();
});
