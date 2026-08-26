import { describe, expect, it } from "vitest";
import { releaseObjectUrl, replaceObjectUrl } from "@/lib/local-audio";

describe("local audio object URLs", () => {
  it("releases replaced and discarded object URLs", () => {
    const revoked: string[] = [];
    const urls = { createObjectURL: () => "blob:new", revokeObjectURL: (url: string) => revoked.push(url) };
    expect(replaceObjectUrl("blob:old", new Blob(["x"]), urls)).toBe("blob:new");
    releaseObjectUrl("blob:new", urls);
    expect(revoked).toEqual(["blob:old", "blob:new"]);
  });
});
