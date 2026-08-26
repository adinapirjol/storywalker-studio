import { describe, expect, it } from "vitest";
import { joinStreetHistory, normaliseStreetName, publicContextAdapter } from "@/lib/linz-adapters";

describe("Linz public-context adapters", () => {
  it("rejects an invalid public record", async () => {
    const adapter = publicContextAdapter("test", async () => [{ id: "x" }]);
    await expect(adapter.load()).rejects.toThrow();
  });
  it("normalises historical street spellings without creating coordinates", () => {
    expect(normaliseStreetName("Hauptstraße  ")).toBe("hauptstrasse");
    expect(joinStreetHistory("Hauptstraße", [{ id: "place-1", name: "Hauptstrasse" }])).toMatchObject({ status: "matched", matchedId: "place-1" });
    expect(joinStreetHistory("Missing-Gasse", [])).toEqual({ originalName: "Missing-Gasse", normalisedName: "missinggasse", status: "unmatched" });
    expect(joinStreetHistory("Hauptstraße", [{ id: "a", name: "Hauptstrasse" }, { id: "b", name: "Hauptstraße" }]).status).toBe("ambiguous");
  });
});
