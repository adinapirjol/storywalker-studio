import type { ResearchNote } from "@/lib/health/research-journal";

export function ResearchEvidence({ note }: { note: ResearchNote }) {
  // Format existing saved summaries without rewriting their evidence or history.
  const text = note.id === "period-comparison"
    ? note.evidence.replace(/\s+(?=\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}:)/g, "\n")
    : note.evidence;
  return <p style={{ whiteSpace: "pre-line" }}>{text}</p>;
}
