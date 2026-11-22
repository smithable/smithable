import { expect, test } from "vitest";
import { sourceLayout } from "./website-layout.js";

test("reads source sections, same-site buttons, reversed picture sides and inline visual hints", () => {
  const html = `<style>body { font-family: Inter } h1, h2 { font-family: 'Playfair Display', serif }</style>
    <body><main>
      <section style="background: linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.3))">
        <h1>Welcome</h1><p>Visit the market.</p>
      </section>
      <section style="display:flex;flex-direction:row-reverse">
        <figure><img src="/stall.webp" alt="The market stall"></figure>
        <div><h2>Find us</h2><p>We are by the quay.</p><a href="/hours">Hours</a>
        <a href="//outside.example/">Outside</a></div>
      </section>
      <section hidden><h2>Ignore this</h2></section>
    </main></body>`;
  const [home] = sourceLayout([
    {
      id: "home",
      url: "https://business.example/",
      html,
      depth: 0,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      bytes: Buffer.byteLength(html),
    },
  ]);
  expect(home).toEqual({
    page: 1,
    bodyFont: "Inter",
    headingFont: "Playfair Display",
    blocks: [
      { title: "Welcome", copy: ["Visit the market."], buttons: [], darkOverlay: true },
      {
        title: "Find us",
        copy: ["We are by the quay."],
        buttons: [{ label: "Hours", href: "/hours" }],
        picture: { alt: "The market stall", side: "right" },
      },
    ],
  });
});
