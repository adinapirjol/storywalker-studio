import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { validateSyntheticArchive } from "./synthetic-observations";
import type { SyntheticArchive } from "../synthetic-archive";

type Purpose = "archive" | "recovery";
function context(purpose: Purpose) {
  return purpose === "archive"
    ? { magic: Buffer.from("SWHSYN01"), domain: Buffer.from("storywalker/health/synthetic-archive/v1") }
    : { magic: Buffer.from("SWHSBK01"), domain: Buffer.from("storywalker/health/synthetic-recovery/v1") };
}
const payloadBytes = 128 * 1024;
export const archiveBytes = 8 + 32 + 12 + 16 + payloadBytes;
function derive(root: Buffer, salt: Buffer, domain: Buffer) {
  if (root.length !== 32) throw new Error("INVALID_ARCHIVE_KEY");
  return Buffer.from(hkdfSync("sha256", root, salt, domain, 32));
}

/** All observation metadata is inside AEAD. Fixed padding also conceals record count. */
export function encryptArchive(archive: SyntheticArchive, root: Buffer, purpose: Purpose = "archive"): Buffer {
  const { magic, domain } = context(purpose);
  const data = Buffer.from(JSON.stringify(validateSyntheticArchive(archive)));
  const padded = Buffer.alloc(payloadBytes);
  const salt = randomBytes(32), iv = randomBytes(12), key = derive(root, salt, domain);
  try {
    if (data.length > payloadBytes - 4) throw new Error("ARCHIVE_LIMIT");
    padded.writeUInt32BE(data.length); data.copy(padded, 4);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.concat([magic, salt, iv, domain]));
    const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
    return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), ciphertext]);
  } finally { data.fill(0); padded.fill(0); key.fill(0); }
}

export function decryptArchive(bytes: Buffer, root: Buffer, purpose: Purpose = "archive"): SyntheticArchive {
  const { magic, domain } = context(purpose);
  if (bytes.length !== archiveBytes || !bytes.subarray(0, 8).equals(magic)) throw new Error("ARCHIVE_UNREADABLE");
  const salt = bytes.subarray(8, 40), iv = bytes.subarray(40, 52), key = derive(root, salt, domain);
  let first: Buffer | undefined, last: Buffer | undefined, plain: Buffer | undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.concat([magic, salt, iv, domain]));
    decipher.setAuthTag(bytes.subarray(52, 68));
    first = decipher.update(bytes.subarray(68)); last = decipher.final();
    plain = Buffer.concat([first, last]);
    const length = plain.readUInt32BE();
    if (length > payloadBytes - 4) throw new Error("ARCHIVE_UNREADABLE");
    return validateSyntheticArchive(JSON.parse(plain.subarray(4, 4 + length).toString("utf8")));
  } catch { throw new Error("ARCHIVE_UNREADABLE"); }
  finally { key.fill(0); first?.fill(0); last?.fill(0); plain?.fill(0); }
}
