import { expect, test } from "vitest";
import { filmFileRefusal } from "./SectionFilm";

test("a film file is refused in the browser only for its type or size; its bytes are the server's", () => {
  const file = (name: string, type: string, size = 1_000_000) => ({ name, type, size });
  expect(filmFileRefusal(file("loop.mp4", "video/mp4"))).toBeUndefined();
  // Some systems give an MP4 no type: its name lets it through to the server's check.
  expect(filmFileRefusal(file("loop.MP4", ""))).toBeUndefined();
  expect(filmFileRefusal(file("loop.mov", ""))).toBe("A film is an MP4 file.");
  expect(filmFileRefusal(file("loop.mp4", "video/quicktime"))).toBe("A film is an MP4 file.");
  expect(filmFileRefusal(file("loop.mp4", "video/mp4", 6_200_000))).toBe(
    "This file is 6.2 MB; a film is at most 5 MB.",
  );
});
