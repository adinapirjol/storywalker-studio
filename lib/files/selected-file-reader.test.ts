import { expect, it, vi } from "vitest";
import { readSelectedTextFiles } from "./selected-file-reader";

it("rejects aggregate oversize selections before reading any private file", async () => {
  const text = vi.fn();
  await expect(readSelectedTextFiles([{ size: 7_000_000, text }, { size: 6_000_000, text }])).rejects.toThrow("complete selection");
  await expect(readSelectedTextFiles(Array.from({ length: 21 }, () => ({ size: 1, text })))).rejects.toThrow("20 files");
  expect(text).not.toHaveBeenCalled();
});

it("reads in order with one active read and stops before a new read after cancellation", async () => {
  const abort = new AbortController();
  const second = vi.fn(async () => "second");
  await expect(readSelectedTextFiles([
    { size: 5, text: async () => { expect(second).not.toHaveBeenCalled(); abort.abort(); return "first"; } },
    { size: 6, text: second },
  ], abort.signal)).rejects.toHaveProperty("name", "AbortError");
  expect(second).not.toHaveBeenCalled();
  expect(await readSelectedTextFiles([{ size: 5, text: async () => "first" }, { size: 6, text: second }])).toEqual(["first", "second"]);
});
