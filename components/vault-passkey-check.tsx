"use client";
import { useEffect, useRef, useState } from "react";

type CheckResult = { available: boolean; authenticator?: boolean; prf?: boolean; failed?: boolean; checkedAt: string; number: number };

export function VaultPasskeyCheck({ active }: { active: boolean }) {
  const [result, setResult] = useState<CheckResult>(), [busy, setBusy] = useState(false);
  const resultPanel = useRef<HTMLDivElement>(null), checkNumber = useRef(0);
  useEffect(() => {
    if (result) {
      resultPanel.current?.focus({ preventScroll: true });
      resultPanel.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [result]);
  async function check() {
    setBusy(true); setResult(undefined);
    const number = ++checkNumber.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!window.isSecureContext || typeof PublicKeyCredential === "undefined") {
        setResult({ available: false, checkedAt: new Date().toLocaleTimeString(), number }); return;
      }
      const api = PublicKeyCredential as typeof PublicKeyCredential & { getClientCapabilities?: () => Promise<Record<string, boolean>> };
      const [authenticator, capabilities] = await Promise.race([
        Promise.allSettled([PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(), api.getClientCapabilities?.()]),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Compatibility check timed out.")), 8_000); }),
      ]);
      setResult({ available: true, authenticator: authenticator.status === "fulfilled" ? authenticator.value : undefined,
        prf: capabilities.status === "fulfilled" ? capabilities.value?.["extension:prf"] : undefined,
        checkedAt: new Date().toLocaleTimeString(), number });
    } catch { setResult({ available: true, failed: true, checkedAt: new Date().toLocaleTimeString(), number }); }
    finally { if (timeout) clearTimeout(timeout); setBusy(false); }
  }
  function nextStep() {
    const target = document.getElementById(active ? "vault-passkey-name" : "vault-passphrase");
    target?.scrollIntoView({ block: "center", behavior: "auto" });
    target?.focus({ preventScroll: true });
  }
  const unsupported = result && (!result.available || result.prf === false);
  return <section className="passkey-compatibility" aria-label="Passkey compatibility check">
    <p>This checks browser support. Creating a passkey is a separate step with a device prompt.</p>
    <button type="button" className="outline-button" disabled={busy} onClick={() => void check()}>{busy ? "Checking browser…" : result ? "Check again" : "Check passkey compatibility"}</button>
    <div aria-live="polite" aria-atomic="true" aria-busy={busy}>
      {busy && <p className="passkey-check-progress" role="status">Checking passkeys, device verification and encryption support…</p>}
      {result && <div ref={resultPanel} tabIndex={-1} className="passkey-check-result" aria-labelledby="passkey-check-title">
        <p className="section-kicker">Check {result.number} · {result.checkedAt}</p>
        <h3 id="passkey-check-title">{result.failed ? "Check could not finish" : unsupported ? "Check complete — try another browser" : "Check complete — setup still needed"}</h3>
        {!result.failed && <dl className="passkey-check-facts">
          <div><dt>Passkeys</dt><dd>{result.available ? "Available" : "Unavailable in this browser"}</dd></div>
          {result.available && <><div><dt>Built-in fingerprint / face / PIN</dt><dd>{result.authenticator === true ? "Available" : "Not reported — another provider or security key may work"}</dd></div>
          <div><dt>Encryption support</dt><dd>{result.prf === true ? "Reported — your chosen passkey still needs testing" : result.prf === false ? "Not supported in this browser" : "Unknown — checked during setup"}</dd></div></>}
        </dl>}
        <p>{result.failed ? "The browser did not finish reporting its capabilities. Try again, or open this same Vault address in a standalone browser." : unsupported ? "Open this same Vault address in a browser with passkey encryption support, then check again." : active ? "Next: name your passkey, confirm you kept the recovery passphrase, and choose Add passkey." : "Next: unlock the Vault with your existing passphrase once. Then choose Add passkey to open the device prompt."}</p>
        {!unsupported && !result.failed && <button type="button" className="primary-button" onClick={nextStep}>{active ? "Go to passkey setup" : "Go to Vault unlock"}</button>}
        <p className="small-note">This check has not created or enrolled a passkey.</p>
      </div>}
    </div>
  </section>;
}
