import { expect, test } from "vitest";
import {
  LOOK_TICKET_TTL,
  LookTicketVerifier,
  mintLookTicket,
  verifyLookTicket,
} from "./look-ticket.js";

const secret = "presentation-only-key";
const facts = {
  project: "project-one",
  document: "document-one",
  parentOrigin: "https://studio.example.test",
  generation: "boot-one:source-one",
};
const now = 1000000;
test("one-use tickets bind project, exact parent, document and preview boot/source generation", () => {
  const { ticket, binding } = mintLookTicket(secret, facts, now);
  expect(verifyLookTicket(ticket, secret, facts, now)).toEqual(binding);
  for (const key of ["project", "document", "parentOrigin", "generation"] as const)
    expect(
      verifyLookTicket(ticket, secret, { ...facts, [key]: `${facts[key]}-other` }, now),
    ).toBeUndefined();
  expect(verifyLookTicket(ticket, "different-key", facts, now)).toBeUndefined();
  expect(verifyLookTicket(ticket.slice(0, -3) + "xyz", secret, facts, now)).toBeUndefined();
  const verifier = new LookTicketVerifier(secret, facts);
  expect(verifier.consume(ticket, facts.document, facts.generation, now)).toEqual(binding);
  expect(verifier.consume(ticket, facts.document, facts.generation, now)).toBeUndefined();
  expect(
    new LookTicketVerifier(secret, facts).consume(
      ticket,
      facts.document,
      "new-boot:same-source",
      now,
    ),
  ).toBeUndefined();
});
test("expired/future/oversize/malformed tickets refuse and the consumed session cache stays bounded", () => {
  const { ticket } = mintLookTicket(secret, facts, now);
  expect(verifyLookTicket(ticket, secret, facts, now + LOOK_TICKET_TTL)).toBeUndefined();
  expect(verifyLookTicket(ticket, secret, facts, now - 1)).toBeUndefined();
  for (const input of ["", "v2.a.b", "v1.a.b", "a".repeat(4097)])
    expect(verifyLookTicket(input, secret, facts, now)).toBeUndefined();
  const verifier = new LookTicketVerifier(secret, facts);
  for (let i = 0; i < 512; i++) {
    const minted = mintLookTicket(secret, facts, now);
    expect(verifier.consume(minted.ticket, facts.document, facts.generation, now)).toBeTruthy();
  }
  const last = mintLookTicket(secret, facts, now);
  expect(verifier.consume(last.ticket, facts.document, facts.generation, now)).toBeUndefined();
  const renewed = mintLookTicket(secret, facts, now + LOOK_TICKET_TTL);
  expect(
    verifier.consume(renewed.ticket, facts.document, facts.generation, now + LOOK_TICKET_TTL),
  ).toBeTruthy();
});
