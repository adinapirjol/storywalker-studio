/** Only fixed messages reach the UI; server exception details can contain private data. */
export function isNativeTransferKey(value: string): boolean {
 return /^[A-Za-z0-9+/]{43}=$/.test(value.trim());
}
const messages: Record<string, string> = {
 VAULT_LOCKED: 'Unlock the Vault in this browser, then retry. Safari and the in-app browser have separate unlock sessions.',
 LOCAL_ORIGIN_REQUIRED: 'Open Storywalker at its local address and retry from that page.',
 TRANSFER_INVALID: 'Choose the encrypted .swtransfer batch and its matching separate transfer key from the iPhone. An acknowledgement receipt is not an import batch.',
 TRANSFER_SCHEMA_INVALID: 'The file decrypted, but its observations did not pass validation. Export a new batch from the updated iPhone app.',
 STALE_REVIEW: 'This batch changed since you opened it. Open saved transfers, then review its current revision.',
 BATCH_CONFLICT: 'A different encrypted file already uses this batch identity. Open saved transfers to review the saved batch.',
 REVIEW_LIMIT: 'The pending review limit is reached. Review existing saved transfers before importing more.',
 SOURCE_UNAVAILABLE: 'This batch is no longer available. Open saved transfers to refresh the list.',
 SOURCE_DELETED: 'This batch was deleted and cannot be accepted. Open saved transfers to refresh the list.',
 REVIEW_REQUIRED: 'Review and accept this batch before downloading its acknowledgement receipt.',
};
export function nativeTransferErrorMessage(code: unknown): string {
 return (typeof code === 'string' && Object.hasOwn(messages, code)
  ? messages[code]
  : 'The transfer could not be completed. Open saved transfers to check whether it was saved before retrying.') + ' Your phone queue remains safe.';
}
