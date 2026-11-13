import { expect, test } from "vitest";
import { devServerEnv } from "./dev.js";

test("the dev server starts lighter, and what the person set stays (T736)", () => {
  expect(devServerEnv({ PATH: "/bin" })).toEqual({
    PATH: "/bin",
    UV_THREADPOOL_SIZE: "2",
    NODE_OPTIONS: "--max-semi-space-size=2",
  });
  // Their own values are kept; their other Node options keep their place before ours.
  expect(
    devServerEnv({ UV_THREADPOOL_SIZE: "8", NODE_OPTIONS: "--max-semi-space-size=16 --inspect" }),
  ).toEqual({ UV_THREADPOOL_SIZE: "8", NODE_OPTIONS: "--max-semi-space-size=16 --inspect" });
  expect(devServerEnv({ NODE_OPTIONS: "--enable-source-maps" }).NODE_OPTIONS).toBe(
    "--enable-source-maps --max-semi-space-size=2",
  );
});
