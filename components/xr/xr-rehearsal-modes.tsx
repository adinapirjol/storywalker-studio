import type { Regime } from "@/lib/xr/journey-experience";
import styles from "./xr-experience.module.css";

/** BODY is a presentation view, never a saved spatial regime or evidence source. */
export function XRRehearsalModes({ active, onRegime, onBody, className }: {
  active: Regime | "BODY";
  onRegime: (mode: Regime) => void;
  onBody?: () => void;
  className?: string;
}) {
  return <nav className={className ?? styles.regimes} aria-label="Rehearsal views">
    {(["WORLD", "TIME", "MEMORY"] as const).map(mode =>
      <button key={mode} aria-pressed={active === mode} onClick={() => onRegime(mode)}>{mode}</button>
    )}
    {onBody && <button aria-pressed={active === "BODY"} onClick={onBody}>BODY</button>}
  </nav>;
}
