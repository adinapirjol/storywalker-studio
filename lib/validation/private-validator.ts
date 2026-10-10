/** Server adapter: selected bytes in, bounded JSON out, no inherited credentials. */
import { spawn } from "node:child_process";
import path from "node:path";

type Validator = "dramaturg.native_transfer" | "dramaturg.body_review" | "dramaturg.health_summary" | "dramaturg.health_events";
const OUTPUT_LIMIT = 2_097_152;

export async function privatePython<T>(plaintext: Buffer, module: Validator, validationNow?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const cwd = path.resolve("research/rehearsal-dramaturg");
    const child = spawn(path.join(cwd, ".venv/bin/python"), ["-m", module, ...(validationNow ? [validationNow] : [])], {
      cwd,
      env: { NODE_ENV: "test", PATH: process.env.PATH, PYTHONPATH: cwd, PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    // Each byte is copied once, rather than repeatedly copying the accumulated JSON.
    const output = Buffer.alloc(OUTPUT_LIMIT);
    let size = 0;
    let failed = false;
    const fail = () => { failed = true; child.kill(); };
    const timer = setTimeout(fail, 10_000);
    child.stdout.on("data", (part: Buffer) => {
      if (failed) return;
      if (size + part.length > OUTPUT_LIMIT) { fail(); return; }
      part.copy(output, size);
      size += part.length;
    });
    child.stderr.resume(); // Drain without exposing private diagnostics.
    child.stdin.on("error", fail);
    child.on("error", () => {
      clearTimeout(timer);
      output.fill(0);
      reject(new Error("VALIDATOR_UNAVAILABLE"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (failed || code !== 0) throw new Error();
        resolve(JSON.parse(output.subarray(0, size).toString()));
      } catch { reject(new Error("TRANSFER_INVALID")); }
      finally { output.fill(0); }
    });
    child.stdin.end(plaintext);
  });
}
