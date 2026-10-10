"use client";

import { useState } from "react";
import { auroraBatch, auroraBodyState, auroraIntegrationCases } from "@/lib/aurora-integrations";
import { BodyComposition } from "./body-composition";
import { NativeBatchTimestamp, NativeBatchTiming } from "./native-batch-timing";
import styles from "./aurora-integration-rehearsal.module.css";

export function AuroraIntegrationRehearsal() {
  const [body] = useState(auroraBodyState);
  const [selected, setSelected] = useState(auroraIntegrationCases.cases[0].id);
  const [access, setAccess] = useState(auroraIntegrationCases.access_cases[0].id);
  const scenario = auroraIntegrationCases.cases.find((item) => item.id === selected)!;
  const boundary = auroraIntegrationCases.access_cases.find((item) => item.id === access)!;

  return <section className={styles.panel} aria-labelledby="aurora-integrations-title">
    <p className={styles.kicker}>AURORA COAST / FICTIONAL / PAUSED</p>
    <h2 id="aurora-integrations-title">A companion at the harbour.</h2>
    <p>Invented evidence for the creature, transfer timing and research boundaries. Step through examples manually. No Watch connection, Vault write or Logfire export runs here.</p>
    <BodyComposition state={body} designOnly />
    <details><summary>Batch Aurora 01 · <NativeBatchTimestamp item={auroraBatch} /></summary>
      <p>{auroraBatch.count} invented observations · awaiting review.</p><NativeBatchTiming item={auroraBatch} />
      <p>Acceptance belongs to the Author. Timing and receipt do not establish meaning or canon.</p>
    </details>
    <details><summary>Research event examples</summary>
      <p>Illustrative 120 / 50 markers with two supporting observations; no medical meaning or personal settings. Expected results are checked against the local Pydantic evaluator in tests.</p>
      <label>Research example<select value={selected} onChange={(event) => setSelected(event.target.value)}>
        {auroraIntegrationCases.cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <table><caption>Invented measured samples</caption><thead><tr><th>Seconds</th><th>BPM</th><th>Source role</th></tr></thead>
        <tbody>{scenario.samples.map((sample, index) => <tr key={index}><td>+{sample.second}</td><td>{sample.bpm}</td><td>{sample.source}</td></tr>)}</tbody>
      </table>
      <p role="status">Offline evaluator expectation: {scenario.expected_kinds.join(", ") || "no candidate"}. Fictional transport itself cannot create real research events.</p>
    </details>
    <details><summary>Access boundaries</summary>
      <label>Access example<select value={access} onChange={(event) => setAccess(event.target.value)}>
        {auroraIntegrationCases.access_cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <p role="status">{boundary.result}</p>
      <p>This explains a boundary; it never grants private access. Actual private pages use the shared Vault modal.</p>
    </details>
  </section>;
}
