# Versioned sample scenarios

The Node test-host API reuses `sampleRunner` and its serialized action queue. Import `sampleRunner`, `captureScenario`, `projectScenarioContext`, `readScenario` and `writeScenario` from `smithable`. Generated apps do not depend on this API.

A version 1 scenario records source/spec revisions, a seed, an initial snapshot identity and digest, clocks, actor ids/roles, engine/profile/dependency metadata, actions/values/targets, and independently authored expected outcomes. It is bounded JSON data, with at most 300 steps and a 2 MB file. A fresh runner and explicit reset/clock/observation adapters are required for replay. The old array replay remains an in-memory diagnostic; it has no persisted compatibility/reset guarantee.

Record from a fresh runner on controlled initial data. Freeze the business clock before recording, keep the entire action log from turn zero, and supply one literal expectation per action. Expectations are never inferred from the generator's permission rules or copied automatically from successful responses:

```ts
const scenario = captureScenario(
  projectScenarioContext(project, recordingIdentity),
  recordedRunner.log(),
  [
    { expectedOutcome: "done", checks: { bookingCount: 1, places: [2] } },
    { expectedOutcome: "refused", checks: { bookingCount: 1, places: [2] } },
  ],
);
writeScenario(file, scenario);
```

`recordingIdentity` supplies the seed, first recorded clock, current actor roster and independently captured initial snapshot identity/digest. `projectScenarioContext` reads project source and declared version metadata afresh; an unknown source revision is refused. Its source fingerprint excludes runtime data. Git-ignored configuration, installed dependencies and deployment settings need separate verification; the metadata is not a signed artifact identity.

Replay with a new runner and host-owned adapters:

```ts
const scenario = readScenario(file);
await previousRunner.drain();
const replay = sampleRunner(runnerOptions);
try {
  await replay.replayScenario(scenario, {
    current: () => projectScenarioContext(project, currentFixtureIdentity()),
    reset: restoreDisposableSnapshotAndVerifyDigest,
    clock: freezeDevelopmentClock,
    observe: readIndependentBusinessOutcomes,
  });
  for (const step of scenario.steps) await replay.step();
  const result = replay.scenarioResult();
  if (result?.status !== "passed") throw new Error(result?.message ?? "Replay incomplete");
} finally {
  await replay.drain();
}
```

`currentFixtureIdentity()` must read the actual current actors and fixture inventory; do not substitute the file's old context as the current-source check. The reset adapter resolves a snapshot from its own controlled inventory, restores its complete disposable dataset (including uploads where present), verifies it, and returns the observed identity/digest. The library does not choose a filesystem path from the scenario or reset production data. Drain other writers before replacing data.

The observation adapter reads fresh persisted state, a fresh browser response, or another independent outcome. It returns named JSON values matching the scenario's `checks`; missing values, non-finite numbers, mismatches and unexpected HTTP outcomes fail the replay. Adapters receive detached action/snapshot data so they cannot accidentally rewrite pinned expectations. The supplied fixture verifies literal SQLite row counts, values and actors across two hash-verified resets; separate browser assurance checks exercise ordinary login, uploads and booking behavior.

Changed source/schema, actors, versions or snapshot identities are incompatible before reset. Compatibility is checked again during replay. Missing moves, wrong clocks, failed reset verification and failed expectations stop the plan. A completed or failed replay does not fall back to random actions. A rejected preparation requires a fresh runner; clearing a plan is an explicit abandonment of its evidence. Cancellation does not undo an action already dispatched. `drain()` waits for admitted reset/action callbacks; those cooperative adapters and the door must provide their own I/O deadlines. This API is not a process supervisor or hosted scheduler.

The authenticated development clock accepts `POST /_dev/clock` with `{ "at": "<recorded ISO time>" }`, within the existing one-year range. This freezes the app's kit business clock; `{ "offset": 0 }` resumes it. Production/demo guards remain in place. Browser clocks, auth expiry and custom code using `Date.now()` are separate clocks. Restore the clock or discard the fixture after testing.

Studio's Release review shows the generating engine, stack profile, recorded template-kit fingerprint and declared dependencies. Missing older metadata stays unknown; a development version is not called up to date. The last recorded tested upgrade comes from the existing successful `Smithable-Upgrade` history entry. `smithable upgrade` retains its existing typecheck/test and rollback path; test it on a staged copy before releasing. A template fix never patches deployed apps automatically.

Repository checks: the scenario/clock/maintenance unit fixtures, `node --test scripts/scenario-clock-http.test.mjs`, and `node --test scripts/staged-upgrade.test.mjs`. The latter reuses the same upgrade flow as the CRM gate, including incompatible custom code and the successful checked upgrade. These are local fixtures, not deployed recovery or hosted availability evidence.
