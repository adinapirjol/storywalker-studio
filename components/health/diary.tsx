"use client";
import { useState } from "react";
import {
  dayKey,
  ratings,
  type Diary,
  type Rating,
  type RatingKey,
} from "@/lib/health/model";
const texts = {
  impulsivity: "Impulsivity (optional)",
  functioning: "Day-to-day functioning",
  medication: "Medication changes (record only)",
  substances: "Caffeine / alcohol",
  illness: "Illness",
  travel: "Travel / timezone context",
  stress: "Major stressors",
} as const;
export function HealthDiary({ onSave }: { onSave: (d: Diary) => void }) {
  const [message, setMessage] = useState("");
  const today = dayKey(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget,
          data = new FormData(form);
        const day = String(data.get("day")),
          mode = String(data.get("mode")) as Diary["mode"];
        if (day > today || (mode === "contemporaneous" && day !== today)) {
          setMessage(
            "Use retrospective for an earlier date. Future observations cannot be saved.",
          );
          return;
        }
        const values = Object.fromEntries(
          Object.keys(ratings).map((k) => {
            const v = String(data.get(k));
            return [k, /^\d$/.test(v) ? Number(v) : v];
          }),
        ) as Record<RatingKey, Rating>;
        const notes = Object.fromEntries(
          Object.keys(texts).map((k) => [k, String(data.get(k) ?? "").trim()]),
        ) as Pick<Diary, keyof typeof texts>;
        onSave({
          id: crypto.randomUUID(),
          day,
          enteredAt: new Date().toISOString(),
          entryOffset: -new Date().getTimezoneOffset(),
          mode,
          certainty: String(data.get("certainty")) as Diary["certainty"],
          ratings: values,
          wantedMore: String(data.get("wantedMore")) as Diary["wantedMore"],
          activity: String(data.get("activity")) as Diary["activity"],
          ...notes,
        });
        form.reset();
        setMessage(
          "Observation saved in this tab only. Earlier observations remain separate.",
        );
      }}
    >
      <p>
        All questions are optional. Separate personal ratings, never a clinical
        score. 0 = none / very low; 4 = very high. Unknown and skipped remain
        distinct.
      </p>
      <div className="health-grid">
        <label>
          Observation date
          <input
            name="day"
            type="date"
            required
            defaultValue={today}
            max={today}
          />
        </label>
        <label>
          Entry timing
          <select name="mode">
            <option value="contemporaneous">Contemporaneous — today</option>
            <option value="retrospective">
              Retrospective — recalling a day
            </option>
          </select>
        </label>
        <label>
          Recall certainty
          <select name="certainty">
            <option>unknown</option>
            <option>low</option>
            <option>medium</option>
            <option>high</option>
          </select>
        </label>
        {Object.entries(ratings).map(([key, label]) => (
          <label key={key}>
            {label}
            <select name={key}>
              <option value="unknown">Unknown</option>
              <option value="skipped">Skipped</option>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === 0
                    ? " — none / very low"
                    : n === 4
                      ? " — very high"
                      : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Did I want more sleep?
          <select name="wantedMore">
            <option>unknown</option>
            <option>skipped</option>
            <option>yes</option>
            <option>no</option>
          </select>
        </label>
        <label>
          Activity compared with my usual level
          <select name="activity">
            <option>unknown</option>
            <option>skipped</option>
            <option>less</option>
            <option>usual</option>
            <option>more</option>
          </select>
        </label>
        {Object.entries(texts).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea name={key} maxLength={1000} rows={2} />
          </label>
        ))}
      </div>
      <button type="submit">Save observation in this tab</button>
      <p role="status">{message}</p>
    </form>
  );
}
