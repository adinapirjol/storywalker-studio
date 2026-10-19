import { baseline, changes, rolling } from "./analysis";
import { ratings, type Diary, type Night } from "./model";
export const reportFields = {
  sleep: "Sleep duration, timing and descriptive changes",
  mood: "Low / elevated / irritable mood",
  energy: "Energy, sleepiness and restedness",
  experience: "Sleep need, racing thoughts and activity",
  context: "Medication, substances, illness, travel and stress",
  functioning: "Impulsivity and functioning",
  questions: "My clinician questions",
} as const;
export type ReportField = keyof typeof reportFields;
export function clinicianReport(input: {
  nights: Night[];
  reference: Night[];
  diary: Diary[];
  fields: ReportField[];
  offset: number;
  threshold: number;
  sustained: number;
  questions: string;
  synthetic: boolean;
  source?: string;
}) {
  const { nights, reference, diary, fields } = input;
  if (!nights.length || !fields.length) return "";
  const selected = new Set(fields),
    base = baseline(reference);
  const marks = changes(nights, base.median, input.threshold, input.sustained);
  const lines = [
    "Storywalker Study 04 — clinician conversation preview",
    input.synthetic
      ? "SYNTHETIC DATA — not a personal medical record."
      : "Private personal observations — user-selected extract.",
    `Period: ${nights[0].day} to ${nights.at(-1)!.day}.`,
    `Coverage: ${nights.filter((n) => n.sleep !== null).length}/${nights.length} windows contain recorded sleep; ${nights.filter((n) => n.reviewed && !n.uncertain && n.sleep !== null).length} reviewed without timing flags. Recording presence does not prove complete sleep capture.`,
    `Reference: ${reference[0]?.day ?? "not selected"} to ${reference.at(-1)?.day ?? "not selected"}; ${base.count}/${base.days} valid reviewed windows.`,
    `Grouping: fixed UTC offset ${input.offset} minutes, noon to noon, labelled by ending date. Longest bout = main candidate; other bouts = nap candidates. Not local civil-day totals during offset changes.`,
    "Evidence layers: wearable estimates; personal reports; descriptive calculations; questions requiring clinical assessment. No diagnosis, episode classification, causal conclusion or medication advice.",
  ];
  if (selected.has("sleep")) {
    lines.push(
      `Selected recording source/device: ${input.source || "not supplied"}.`,
    );
    lines.push(
      `Reference median: ${base.median?.toFixed(2) ?? "insufficient"} h; median absolute deviation: ${base.mad?.toFixed(2) ?? "unavailable"} h. Minimum 7 valid windows and 50% coverage is an analytical choice, not a DSM criterion.`,
      `Changes from baseline: at least ${input.threshold} h in the same direction for ${input.sustained} consecutive reviewed windows; gaps break runs.`,
    );
    nights.forEach((n, i) => {
      const trend = rolling(nights, i);
      lines.push(
        `${n.day}: main ${n.sleep?.toFixed(2) ?? "unknown"} h; in bed ${n.inBed?.toFixed(2) ?? "unknown"} h; nap candidates ${n.naps?.toFixed(2) ?? "unknown"} h; total recorded /24h ${n.total?.toFixed(2) ?? "unknown"} h; onset/waking ${n.onset ?? "?"}/${n.waking ?? "?"}; trailing 7-window median ${trend.value?.toFixed(2) ?? "insufficient"} h (n=${trend.n}); ${n.uncertain ? "timing uncertainty" : "fixed-offset labels"}; ${n.reviewed ? "coverage reviewed" : "coverage unreviewed"}${marks.has(n.day) ? "; change from baseline" : ""}.`,
      );
    });
  }
  const included = diary.filter(
    (d) => d.day >= nights[0].day && d.day <= nights.at(-1)!.day,
  );
  if (
    fields.some((f) =>
      ["mood", "energy", "experience", "context", "functioning"].includes(f),
    )
  ) {
    lines.push(
      `Diary coverage: ${new Set(included.map((d) => d.day)).size}/${nights.length} dates; blank fields are unknown/skipped, not absent symptoms. Ratings 0–4 are personal ratings, not clinical scores.`,
    );
    for (const d of included) {
      lines.push(
        `${d.day} — entered ${d.enteredAt}, entry UTC offset ${d.entryOffset} min; ${d.mode}; recall certainty ${d.certainty}.`,
      );
      const keys = [
        ...(selected.has("mood")
          ? (["low", "elevated", "irritable"] as const)
          : []),
        ...(selected.has("energy")
          ? (["energy", "sleepiness", "rested"] as const)
          : []),
      ];
      keys.forEach((k) => lines.push(`${ratings[k]}: ${d.ratings[k]}.`));
      if (selected.has("experience"))
        lines.push(
          `Wanted more sleep: ${d.wantedMore}; racing thoughts: ${d.ratings.racing}; activity vs usual: ${d.activity}.`,
        );
      if (selected.has("context"))
        for (const k of [
          "medication",
          "substances",
          "illness",
          "travel",
          "stress",
        ] as const)
          lines.push(`${k}: ${d[k] || "not recorded"}`);
      if (selected.has("functioning"))
        lines.push(
          `Impulsivity: ${d.impulsivity || "not recorded"}; functioning: ${d.functioning || "not recorded"}.`,
        );
    }
  }
  lines.push(
    "Uncertainty: wearable estimates can miss quiet wake and sleep; missing data are unknown; offset changes, conflicting awake/asleep records and noon splits may alter grouping; retrospective reports may be incomplete. Correlations are not calculated in this version. No existing journey data were connected.",
  );
  if (selected.has("questions"))
    lines.push(
      `Questions for my clinician: ${input.questions || "None entered."}`,
    );
  return lines.join("\n\n");
}
