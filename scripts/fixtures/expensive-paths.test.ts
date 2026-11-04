// Injected only into an owned generated fixture by benchmark-expensive-paths.mjs.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { db } from "#/db";
import { bookings, classTypes, instructors, sessions, user } from "#/db/schema";
import { bookingData } from "#/generated/booking.server";
import { classTypeData } from "#/generated/class-type.server";
import { deleteFile, release, reserveUpload, roomFor, saveFile } from "#/kit/uploads";

const summaries: unknown[] = [];
async function measure(
  size: number,
  name: string,
  operation: () => unknown | Promise<unknown>,
  repeats = 7,
) {
  const samples: number[] = [];
  let failures = 0;
  for (let n = 0; n < repeats; n++) {
    const start = performance.now();
    try {
      await operation();
    } catch {
      failures++;
    }
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  summaries.push({
    size,
    name,
    samplesMs: samples,
    p50Ms: samples[Math.ceil(samples.length * 0.5) - 1],
    p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
    failures,
  });
  expect(failures, name).toBe(0);
}
test("measured candidate, relation and upload paths retain complete permitted selection", async () => {
  const admin = {
    id: "bench-admin",
    name: "Admin",
    email: "admin@synthetic.example",
    role: "admin",
  };
  const member = {
    id: "bench-member",
    name: "Member",
    email: "member@synthetic.example",
    role: "member",
  };
  db.insert(user).values([admin, member]).run();
  db.insert(instructors).values({ id: 1, name: "Synthetic instructor" }).run();
  let fakeNow = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
  process.env.UPLOADS_MAX_BYTES = "10000000";
  // A write during the yielded scan must force a recount without losing live holds.
  process.env.UPLOADS_MAX_BYTES = "100";
  const held = roomFor(80);
  expect(held).toBeDefined();
  fakeNow += 61000;
  const pending = reserveUpload(20);
  const stored = saveFile("record", new TextEncoder().encode("x".repeat(40)), "proof.txt", held);
  const second = await pending;
  expect(second).toBeDefined();
  expect(await reserveUpload(41)).toBeUndefined();
  release(second);
  const third = await reserveUpload(60);
  expect(third).toBeDefined();
  deleteFile(stored, false);
  const afterDelete = saveFile(
    "record",
    new TextEncoder().encode("z".repeat(60)),
    "still-active.txt",
    third,
  );
  deleteFile(afterDelete, false);
  const reclaimed = await reserveUpload(100);
  expect(reclaimed).toBeDefined();
  release(reclaimed);
  process.env.UPLOADS_MAX_BYTES = "10000000";
  for (const size of [1000, 10000, 100000]) {
    db.delete(bookings).run();
    db.delete(sessions).run();
    db.delete(classTypes).run();
    db.transaction(() => {
      for (let offset = 0; offset < size; offset += 100)
        db.insert(classTypes)
          .values(
            Array.from({ length: Math.min(100, size - offset) }, (_, i) => ({
              id: offset + i + 1,
              name: `Class ${String(offset + i + 1).padStart(6, "0")}`,
              durationMinutes: 60,
              level: "beginner" as const,
            })),
          )
          .run();
    });
    await measure(size, "candidate full list then 50 ids", async () => {
      expect((await classTypeData.list(admin)).slice(0, 50)).toHaveLength(50);
    });
    await measure(size, "bounded candidate ids", async () => {
      const ids = await classTypeData.candidateIds(admin);
      expect(ids).toHaveLength(50);
      expect(ids[0]).toBe(size);
    });
    expect(await classTypeData.candidateIds(admin, (row) => row.id === 1)).toEqual([1]);
    await measure(size, "explicit relation full options", async () => {
      expect(
        (await classTypeData.list(admin)).map((r) => ({ value: String(r.id), label: r.name })),
      ).toHaveLength(size);
    });
    await measure(size, "bounded relation text search", () => {
      const found = classTypeData.pick(admin, "Class 000001");
      expect(found.some((r) => r.value === "1")).toBe(true);
      expect(found.length).toBeLessThanOrEqual(20);
    });
    db.insert(sessions)
      .values({
        id: 1,
        classTypeId: 1,
        instructorId: 1,
        startsAt: new Date("2030-01-01T10:00:00Z"),
        capacity: 5,
      })
      .run();
    db.insert(bookings)
      .values([
        { id: 1, sessionId: 1, attendeeId: member.id },
        { id: 2, sessionId: 1, attendeeId: admin.id },
      ])
      .run();
    expect(await bookingData.candidateIds(member)).toEqual([1]);
    await expect(bookingData.candidateIds(null)).rejects.toThrow();
    expect(await bookingData.candidateIds(admin)).toEqual([2, 1]);
    // Oldest record is still found when chosen explicitly, independent of first search page.
    expect(classTypeData.pick(admin, "", [1]).map((r) => r.value)).toEqual(["1"]);
    const dir = join("data/test/uploads/bench");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < size; i++) writeFileSync(join(dir, String(i)), "x");
    await measure(
      size,
      "cold synchronous upload rescan",
      () => {
        fakeNow += 61000;
        const held = roomFor(1);
        expect(held).toBeDefined();
        release(held);
      },
      5,
    );
    let beats = 0;
    const heartbeat = setInterval(() => beats++, 1);
    try {
      await measure(
        size,
        "cold asynchronous upload admission",
        async () => {
          fakeNow += 61000;
          const held = await reserveUpload(1);
          expect(held).toBeDefined();
          release(held);
        },
        5,
      );
    } finally {
      clearInterval(heartbeat);
    }
    expect(beats).toBeGreaterThan(0);
    summaries.push({ size, name: "event loop heartbeat during async scans", beats });
    await measure(size, "warm upload reservation", () => {
      const held = roomFor(1);
      expect(held).toBeDefined();
      release(held);
    });
  }
  vi.restoreAllMocks();
  writeFileSync(
    "expensive-paths.json",
    JSON.stringify({
      status: "passed",
      scope:
        "Local generated booking data functions; synthetic ClassType records and one-byte files; seven samples (five cold scans), warm SQLite page cache; no network or hosted claims.",
      measurements: summaries,
    }),
  );
}, 240000);
