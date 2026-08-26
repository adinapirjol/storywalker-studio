import { describe, expect, it } from "vitest";
import { applyLinzDecision, getLinzProposals, linzPublicAdapter, locativeManifest } from "@/lib/linz-experiment";

describe("Linz Public City, Private Echoes", () => {
  it("keeps the required public worlds distinct and has three deterministic locations", async () => {
    const records = await linzPublicAdapter.load();
    expect(records.filter((record) => record.sourceLabel.includes("Ars Electronica"))).toHaveLength(3);
    expect(records.filter((record) => record.sourceLabel.includes("City of Linz"))).toHaveLength(3);
    expect(getLinzProposals()).toHaveLength(3);
  });
  it("never turns a proposal into authored meaning without an explicit decision", () => {
    const proposal = getLinzProposals()[0];
    expect(proposal.ledger.authorDecision).toBe("inferred");
    expect(applyLinzDecision(proposal, "accepted").ledger.authorDecision).toBe("authored");
    expect(applyLinzDecision(proposal, "refused").ledger.authorDecision).toBe("refused");
  });
  it("exports only a portable generalised manifest", () => {
    const manifest = locativeManifest();
    expect(manifest.privacy).toBe("public-synthetic-only");
    expect(manifest.zones.every((zone) => zone.coordinate === null)).toBe(true);
  });
});
