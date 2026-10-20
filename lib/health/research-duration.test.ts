import { expect, it } from "vitest";
import { researchTimeline, periodComparisons } from "./analysis";
import { observatoryInsights } from "./observatory-insights";
import { parseSleepXml } from "./apple-import";
import { dates, type Night } from "./model";
const row = (start: string, end: string, source = "Fictional Watch", stage = "Asleep") => `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${source}" startDate="${start}" endDate="${end}" value="HKCategoryValueSleepAnalysis${stage}"/>`;
const analyse = (xml: string, from="2026-10-01", to="2026-10-03") => researchTimeline(parseSleepXml(`<HealthData>${xml}</HealthData>`).records, from, to);
it("uses elapsed time across offset changes and keeps a noon-crossing bout whole", () => {
  const ns = analyse(row("2026-10-01 07:00:00 +0200", "2026-10-01 15:00:00 +0300"));
  expect(ns[0]).toMatchObject({sleep:7,total:7,onset:"07:00",waking:"15:00",uncertain:false});
  expect(ns[0].timingNotes).toHaveLength(1);
  expect(ns[1].sleep).toBeNull();
});
it("joins stages across midnight without duplicating a generic source; preserves other bouts", () => {
  const ns = analyse(row("2026-10-01 23:00:00 +0200","2026-10-02 03:00:00 +0200","Fictional Watch","AsleepCore") + row("2026-10-02 03:00:00 +0200","2026-10-02 07:00:00 +0200","Fictional Watch","AsleepREM") + row("2026-10-01 23:00:00 +0200","2026-10-02 07:00:00 +0200","Fictional Other") + row("2026-10-02 14:00:00 +0200","2026-10-02 15:00:00 +0200"));
  expect(ns[0].sleep).toBeNull();
  expect(ns[1]).toMatchObject({sleep:8,naps:1,total:9,uncertain:false});
});
it("retains duration conflicts and flags implausibly long merged bouts", () => {
  expect(analyse(row("2026-10-01 23:00:00 +0200","2026-10-02 07:00:00 +0200")+row("2026-10-02 00:00:00 +0200","2026-10-02 08:00:00 +0200","Fictional Other"))[1].uncertain).toBe(true);
  expect(analyse(row("2026-10-01 01:00:00 +0200","2026-10-02 07:00:00 +0200"))[1].uncertaintyReasons).toContain("A candidate sleep bout spans more than 24 hours");
});
it("compares sparse whole-period observations without filling gaps or requiring the first fortnight", () => {
  const ns: Night[] = dates("2026-07-18","2026-10-15").map((day,i)=>({day,sleep:[15,20,25,35,40,45,65,70,75].includes(i)?(i<30?6:i<60?7:8):null,total:null,inBed:null,naps:null,onset:null,waking:null,uncertain:false,reviewed:true,records:0}));
  const {overall,periods}=periodComparisons(ns);
  expect(overall).toMatchObject({count:9,missing:81,median:7});
  expect(periods.map(p=>p.median)).toEqual([6,7,8]);
  const notes=observatoryInsights(ns).notes;
  expect(notes.find(n=>n.id==='period-difference')?.evidence).toContain('2.00 h');
  expect(notes.find(n=>n.id==='duration-coverage')?.evidence).toContain('81 missing');
  expect(periodComparisons(ns.slice(0,24)).overall.median).toBeNull();
});
