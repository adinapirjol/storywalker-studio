type SelectedTextFile = Pick<File, "size" | "text">;
const MAX_FILES = 20;
export const MAX_SELECTED_TEXT_BYTES = 12_000_000;

/** Bound the whole selection before reading; do not fan out file reads. */
export async function readSelectedTextFiles(files: readonly SelectedTextFile[], signal?: AbortSignal) {
  if (!files.length || files.length > MAX_FILES) throw new Error("Choose between 1 and 20 files for one browser import.");
  let total = 0;
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size < 0) throw new Error("The selected file size is invalid.");
    total += file.size;
    if (total > MAX_SELECTED_TEXT_BYTES) throw new Error("Keep the complete selection within 12 MB. Use the local CLI minimiser for larger exports.");
  }
  const contents: string[] = [];
  for (const file of files) {
    signal?.throwIfAborted();
    const text = await file.text();
    signal?.throwIfAborted();
    contents.push(text);
  }
  return contents;
}
