import { expect, test } from "vitest";
import { fileRefusal, pictureName } from "./SectionPicture";

test("an uploaded section picture gets a new name of its own under images/", () => {
  const name = pictureName("home", "hero", "webp", 1_700_000_000_000);
  expect(name).toMatch(/^images\/home-hero-[0-9a-z]+\.webp$/);
  // Another moment, another file: a replaced picture is never written over.
  expect(pictureName("home", "hero", "webp", 1_700_000_000_001)).not.toBe(name);
  // A page or section name with other characters still makes a file name core accepts.
  expect(pictureName("About Us", "media.1", "png", 1)).toBe("images/about-us-media-1-1.png");
});

test("a chosen file is refused before it is read when it is not a picture or too large", () => {
  expect(fileRefusal({ type: "image/webp", size: 1000 })).toBeUndefined();
  expect(fileRefusal({ type: "image/jpeg", size: 2 * 1024 * 1024 })).toBeUndefined();
  expect(fileRefusal({ type: "image/svg+xml", size: 1000 })).toMatch(/webp, jpg/);
  expect(fileRefusal({ type: "image/png", size: 3 * 1024 * 1024 })).toMatch(/3\.0 MB/);
});
