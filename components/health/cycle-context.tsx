"use client";
import { useState } from "react";
import { cycleContextSchema, type CycleContext } from "@/lib/health/cycle-context";

export function CycleContextForm({ saved, busy, onSave }: {
  saved?: CycleContext; busy: boolean; onSave: (context: CycleContext | null) => void;
}) {
  const [message, setMessage] = useState("");
  return <section aria-label="Optional menstrual cycle context">
    <h3>Cycle day · optional context</h3>
    <p>Self-reported calendar context, separate from measurements. No automatic hormonal interpretation, day progression or predictions. Including it adds a dated annotation only; sleep calculations stay unchanged.</p>
    <form key={JSON.stringify(saved ?? null)} onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const length = String(data.get("expectedLength") ?? "").trim();
      const parsed = cycleContextSchema.safeParse({ date: data.get("date"), day: Number(data.get("cycleDay")),
        ...(length ? { expectedLength: Number(length) } : {}), included: data.get("included") === "on" });
      if (!parsed.success) { setMessage("Enter a valid date and whole cycle day (1–366). Expected length can be blank. These bounds are input limits, not a clinical range."); return; }
      setMessage(""); onSave(parsed.data);
    }}>
      <fieldset disabled={busy}>
        <legend>Dated self-report</legend>
        <label>Observation date<input name="date" type="date" required defaultValue={saved?.date ?? ""} /></label>
        <label>Cycle day<input name="cycleDay" type="number" min={1} max={366} step={1} required defaultValue={saved?.day ?? ""} /></label>
        <label>Expected cycle length in days (optional)<input name="expectedLength" type="number" min={1} max={366} step={1} defaultValue={saved?.expectedLength ?? ""} /></label>
        <label><input name="included" type="checkbox" defaultChecked={saved?.included ?? false} /> Include cycle context in analysis</label>
        <p>Save to apply the toggle. Off retains the field privately but leaves it out of current analysis. Only the reported date is annotated when it falls within the displayed period. Saving another date replaces this field; earlier analysis snapshots remain unchanged.</p>
        <button type="submit">Save cycle context privately</button>
        {saved && <button type="button" onClick={() => onSave(null)}>Remove current cycle field</button>}
      </fieldset>
    </form>
    {saved && <p>Saved: {saved.date} · day {saved.day} · {saved.included ? "included when within analysis dates" : "excluded from analysis"}. Earlier saved analyses may still contain previously included context.</p>}
    <p role="status">{message}</p>
  </section>;
}
