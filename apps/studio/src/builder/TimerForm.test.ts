import { validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { timerDates } from "./TimerForm";

test("timer date choices follow one single-record reference and exclude computed dates and lists", () => {
  const checked = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Dates }
models:
  Venue:
    fields:
      name: string
      opensAt: datetime
      sessions: Session[]
  Session:
    fields:
      begins: datetime
      day: date
      copiedDay: { type: date, formula: day }
      venue: Venue
      bookings: Booking[]
  Booking:
    fields:
      ownDate: date
      session: Session!
`,
  });
  expect(checked.diagnostics).toEqual([]);
  const models = checked.ir?.models ?? [];
  expect(
    timerDates(
      models.find((m) => m.name === "Booking"),
      models,
    ),
  ).toEqual(["ownDate", "session.begins", "session.day"]);
  expect(
    timerDates(
      models.find((m) => m.name === "Session"),
      models,
    ),
  ).toEqual(["begins", "day", "venue.opensAt"]);
});
