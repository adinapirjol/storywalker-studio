import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";

export function passkeyBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
}
export function passkeyBase64(value: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function requireBrowser() {
  if (!window.isSecureContext || typeof PublicKeyCredential === "undefined") throw new Error("Passkeys are unavailable in this browser. Open the local Vault in a current Safari or Chrome window.");
}
export async function createVaultPasskey(options: PublicKeyCredentialCreationOptionsJSON): Promise<RegistrationResponseJSON> {
  requireBrowser();
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options, challenge: passkeyBytes(options.challenge), user: { ...options.user, id: passkeyBytes(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map(({ id, type }) => ({ id: passkeyBytes(id), type })),
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  };
  const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey creation was cancelled.");
  const response = credential.response as AuthenticatorAttestationResponse;
  return { id: credential.id, rawId: passkeyBase64(credential.rawId), type: "public-key", clientExtensionResults: {},
    response: { clientDataJSON: passkeyBase64(response.clientDataJSON), attestationObject: passkeyBase64(response.attestationObject), transports: response.getTransports?.() as RegistrationResponseJSON["response"]["transports"] } };
}
export async function authenticateVaultPasskey(options: PublicKeyCredentialRequestOptionsJSON, salt: string): Promise<{ response: AuthenticationResponseJSON; prf: string }> {
  requireBrowser();
  const credential = await navigator.credentials.get({ publicKey: {
    ...options, challenge: passkeyBytes(options.challenge),
    allowCredentials: options.allowCredentials?.map(({ id, type }) => ({ id: passkeyBytes(id), type })),
    extensions: { prf: { eval: { first: passkeyBytes(salt) } } } as AuthenticationExtensionsClientInputs,
  } }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey verification was cancelled.");
  const extensions = credential.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const first = extensions.prf?.results?.first;
  if (!first || first.byteLength !== 32) throw new Error("This passkey cannot protect the Vault’s encryption key. Try a passkey provider or security key with PRF support. Your passphrase still works.");
  const response = credential.response as AuthenticatorAssertionResponse;
  try {
    return { prf: passkeyBase64(first), response: { id: credential.id, rawId: passkeyBase64(credential.rawId), type: "public-key", clientExtensionResults: {},
      response: { clientDataJSON: passkeyBase64(response.clientDataJSON), authenticatorData: passkeyBase64(response.authenticatorData), signature: passkeyBase64(response.signature), ...(response.userHandle ? { userHandle: passkeyBase64(response.userHandle) } : {}) } } };
  } finally { new Uint8Array(first).fill(0); }
}
export function passkeyError(error: unknown) {
  if (error instanceof DOMException && ["NotAllowedError", "AbortError"].includes(error.name)) return "The device prompt was cancelled or timed out. Retry when ready; your existing access still works.";
  if (error instanceof DOMException && error.name === "InvalidStateError") return "This provider already has a passkey for this Vault. Choose another provider or use your existing passkey.";
  return error instanceof Error ? error.message : "Passkey setup did not complete. Your passphrase still works.";
}
