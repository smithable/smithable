// Run the real fixture both clean and with narrow generated-fixture fault injections.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
export async function calibrate(script) {
  const results = [];
  for (const defect of [undefined, "permission", "count", "persistence"]) {
    const name = defect ?? "clean",
      path = resolve(`test-results/booking-${name}.json`);
    console.log(`CALIBRATION ${name}`);
    const nonce = randomUUID();
    rmSync(path, { force: true });
    const args = [
      script,
      "--evidence",
      path,
      "--nonce",
      nonce,
      ...(defect ? ["--seed-defect", defect] : []),
    ];
    const env = { ...process.env };
    for (const name of ["TEST_BOOKING_DIR", "TEST_BOOKING_KEEP", "TEST_BOOKING_EVIDENCE"])
      delete env[name];
    const child = spawn(process.execPath, args, { env, detached: true, stdio: "inherit" });
    const signal = (name) => {
      try {
        process.kill(-child.pid, name);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    };
    let timedOut = false,
      hard;
    const timeout = setTimeout(() => {
      timedOut = true;
      signal("SIGTERM");
      hard = setTimeout(() => signal("SIGKILL"), 10000);
    }, 240000);
    const code = await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("exit", done);
    }).finally(() => {
      clearTimeout(timeout);
      clearTimeout(hard);
    });
    assert.equal(timedOut, false, `${name} timed out rather than completing its oracle`);
    const evidence = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(evidence.nonce, nonce, "child evidence belongs to another run");
    if (!defect) {
      assert.equal(code, 0);
      assert.equal(evidence.status, "passed");
      const prefixes = [
        "disposable booking",
        "published app",
        "ordinary email-code",
        "two real accounts",
        "ownership survives",
        "owner upload",
        "real administrator creates keys",
        "hidden cancel",
        "administrator export",
        "revoked key",
        "mobile visitor",
        "administrator can cancel",
      ];
      assert.equal(
        new Set(evidence.checks.map((check) => check.name)).size,
        evidence.checks.length,
        "duplicate checks cannot establish matrix coverage",
      );
      for (const prefix of prefixes)
        assert.ok(
          evidence.checks.some(
            (check) => check.name.startsWith(prefix) && check.status === "passed",
          ),
          `missing clean check ${prefix}`,
        );
    } else {
      assert.equal(code, 1, `${name} did not contradict the independent oracle`);
      assert.equal(evidence.status, "failed");
      const expected =
        defect === "permission" ? "ownership survives reload" : "two real accounts contend";
      assert.ok(
        evidence.failedCheck?.startsWith(expected),
        `${name} failed during ${evidence.failedCheck}, not its intended check`,
      );
      assert.match(
        evidence.error,
        defect === "permission"
          ? /Second account read another member booking/
          : defect === "count"
            ? /available-place count mismatch/
            : /one committed booking/,
      );
    }
    results.push({
      defect: name,
      status: "passed",
      expectedExit: defect ? 1 : 0,
      observedExit: code,
      evidence: path,
    });
  }
  mkdirSync(resolve("test-results"), { recursive: true });
  writeFileSync(
    resolve("test-results/booking-calibration.json"),
    `${JSON.stringify({ status: "passed", cases: results }, null, 2)}\n`,
  );
  console.log("PASS clean published booking matrix and all three planted-defect variants");
}
