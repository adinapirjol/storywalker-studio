export function replaceObjectUrl(
  current: string | undefined,
  file: Blob,
  urls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
) {
  if (current) urls.revokeObjectURL(current);
  return urls.createObjectURL(file);
}

export function releaseObjectUrl(
  current: string | undefined,
  urls: Pick<typeof URL, "revokeObjectURL"> = URL,
) {
  if (current) urls.revokeObjectURL(current);
}
