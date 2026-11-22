import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { STACK_PROFILE } from "@smithable/adapter-tanstack";
import { expect, test } from "vitest";
import { landingKitRevision, maintenanceInfo, templateKitRevision } from "./maintenance.js";
import { tempDir } from "./test-dir.js";
import { VERSION } from "./version.js";

test("unknown and old template versions do not claim a current deployed kit", () => {
  const dir = tempDir("maintenance-");
  expect(maintenanceInfo(dir).status).toBe("Generation metadata unavailable");
  writeFileSync(
    join(dir, "smithable.lock"),
    JSON.stringify({ smithable: VERSION, stackProfile: STACK_PROFILE.id }),
  );
  expect(maintenanceInfo(dir).status).toContain("Template revision unknown");
  writeFileSync(
    join(dir, "smithable.lock"),
    JSON.stringify({ smithable: VERSION, stackProfile: STACK_PROFILE.id, kitRevision: "old" }),
  );
  expect(maintenanceInfo(dir).status).toContain("differs");
  writeFileSync(
    join(dir, "smithable.lock"),
    JSON.stringify({
      smithable: VERSION,
      stackProfile: STACK_PROFILE.id,
      kitRevision: templateKitRevision,
    }),
  );
  expect(maintenanceInfo(dir).status).toContain(
    VERSION === "0.0.0" ? "Development version" : "Recorded versions match",
  );
  expect(maintenanceInfo(dir).upgrade).toBeUndefined();
});

test("maintenance uses the matching kit revision for section pictures", () => {
  const dir = tempDir("maintenance-section-pictures-");
  const lock = (kitRevision: string) =>
    writeFileSync(
      join(dir, "smithable.lock"),
      JSON.stringify({ smithable: VERSION, stackProfile: STACK_PROFILE.id, kitRevision }),
    );

  const sectionPictureKitRevision = landingKitRevision(["section-pictures"]);
  lock("section-pictures:old");
  expect(maintenanceInfo(dir)).toMatchObject({
    currentKit: sectionPictureKitRevision,
    status: expect.stringContaining("Template revision differs"),
  });

  lock(sectionPictureKitRevision);
  expect(maintenanceInfo(dir)).toMatchObject({
    generatedKit: sectionPictureKitRevision,
    currentKit: sectionPictureKitRevision,
    status: expect.stringContaining(
      VERSION === "0.0.0" ? "Development version" : "Recorded versions match",
    ),
  });
});
