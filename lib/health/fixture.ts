/** Entirely invented dates, devices and observations. No personal history. */
import { parseSleepXml } from "./apple-import";
export function syntheticImport() {
  const rows: string[] = [];
  for (let day = 1; day <= 28; day++) {
    if (day === 18 || day === 24) continue;
    const date = `2026-02-${String(day).padStart(2, "0")}`;
    const start = day > 20 ? "02:00:00" : "00:00:00";
    const end = day % 3 === 0 ? "07:30:00" : "08:00:00";
    const attrs = `type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Synthetic Watch" sourceVersion="fixture-1" device="Invented device" startDate="${date} ${start} +0200" endDate="${date} ${end} +0200"`;
    rows.push(
      `<Record ${attrs} value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>`,
    );
    rows.push(`<Record ${attrs} value="HKCategoryValueSleepAnalysisInBed"/>`);
    if (day === 6)
      rows.push(
        `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Synthetic Watch" device="Invented device" startDate="${date} 01:00:00 +0200" endDate="${date} 02:00:00 +0200" value="HKCategoryValueSleepAnalysisAsleepDeep"/>`,
      );
  }
  rows.push(
    '<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Synthetic Watch" device="Invented device" startDate="2026-02-09 14:00:00 +0200" endDate="2026-02-09 14:30:00 +0200" value="HKCategoryValueSleepAnalysisAsleep"/>',
  );
  return parseSleepXml(`<HealthData>${rows.join("")}</HealthData>`);
}
