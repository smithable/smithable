# Legal and licence decisions before the repository goes public

Status: 2026-09-30, Fable, for the user and their legal review; reconciled 2026-10-01 with the consolidated handoff (Johan, ChatGPT and Claude, 30 September 2026), whose corrections are folded in below and take precedence where the two differ. Each item is a decision with what it implies. Nothing here is legal advice; it is the engineering view of what the choices do.

**Settled (handoff §1–2):** the operator is **Åland IT AB** (formerly Yolimi AB, the same entity), operated from Åland; engine Apache-2.0, own kit and templates 0BSD, DCO without a CLA, the service code private; generated apps carry third-party notices (`LICENSES/shadcn-ui.txt`, built 2026-10-01, in the image too) and are never promised "without any obligation" as a whole. The licence decision is not reopened.

## 1. The engine's licence: Apache-2.0 (recommended), and what it gives away

**Decision:** Apache-2.0 for everything in this repository except the app kit (§2). The files are in place.

**What it implies**

- Anyone may use, change, sell and **host Smithable as a service**, including a competitor, as long as they keep the notices. The hosted product's advantage is then the service code (`smithable-cloud`, which stays private: accounts, gateway, workspaces, publishing, backups, mail relay), the model allowances, the domain and the name — not the engine. This is the usual open-core shape and it matches the vision ("the engine is open so the app owner is never locked in").
- **Patent grant:** contributors grant patent rights for their contributions and lose them if they sue over the project. Good for users, and the reason Apache-2.0 is preferred over MIT for anything a company builds on.
- **Trademark is excluded** (Apache §6): the licence grants no right to the name. §4 relies on this.
- **No copyleft:** changes to the engine may stay private. If the concern is "a large host takes the engine and never gives back", the alternatives are AGPL-3.0 (any host must publish its changes to the engine, which also deters agencies and embedders, and makes the MCP/library use awkward) or a source-available licence such as BSL 1.1 (not open source; converts to Apache after a few years; excludes competing hosting). My view: the engine is the on-ramp, and the hosted service competes on the service, so Apache-2.0. The choice is reversible only while there are few outside contributors (§3).

## 2. The app kit and templates: 0BSD (recommended)

**Decision:** 0BSD for `packages/adapter-tanstack/templates/` (the kit files copied into every generated app) and for the design delivery (`docs/design/delivery/`, already 0BSD by its author).

**What it implies**

- A generated app carries **no obligation** from Smithable: no notice, no attribution, nothing to ship. The owner may license the app however they want. This is the point of the promise "the generated app is yours" and the reason 0BSD rather than MIT (MIT would require the copyright notice to travel with every generated app).
- Anyone may copy the kit into anything. It is small and deliberately unremarkable, so that costs nothing.
- **Third-party code inside the templates:** `src/components/ui/*` are shadcn/ui components (MIT). MIT asks that the copyright notice be kept with copies. shadcn's own CLI copies them without one and the project treats that as intended, but to be safe the generated app should carry a `LICENSES/shadcn-ui.txt` (the MIT text and the copyright line) — one small change, listed in public-release.md. Fonts are OFL-1.1 (hosted with the app; the OFL allows it and asks nothing of the app), Lucide icons ISC.
- **Dependencies of a generated app** (checked 2026-09-30 on a fresh CRM: 190 MIT, 17 ISC, 13 Apache-2.0, 4 BSD, 2 MPL-2.0 build tools, one OFL font, `caniuse-lite` data under CC-BY-4.0): all permissive; nothing copyleft reaches the app's own code. The monorepo's own dependencies are the same picture (MPL only in `axe-core` and `lightningcss`, both tools).

## 3. Who owns the code, and how contributions are taken

**Decision A: the copyright holder.** The files say "Johan Ekenlycka". The operator is Åland IT AB; document which parts Johan and which the company own today, and any assignment to the company, before the flip. Updating the headers does not transfer anything; outside contributions later do not stop Johan from assigning his own rights, and the company's earlier name change needs no new transfer of what it already owns. The trademark (§4) belongs with the company.

**Decision B: DCO or CLA.** `CONTRIBUTING.md` uses the **DCO** (each contributor signs off that they have the right to contribute under the repository's licence; they keep their copyright). Implications:

- Simple, no paperwork, the norm for Apache-2.0 projects.
- Published Apache grants cannot be withdrawn, and a later change of licence works only within the rights actually held: contributors' conditions stay. Accept Apache as the durable engine strategy; no CLA by default.
- My view: DCO, and accept that Apache-2.0 is permanent for the code that exists at the flip. The hosted service stays private regardless.

**Decision C: AI-written code.** Most of the code was written by AI agents under the user's direction, with no AI attribution in the history (a repository rule). Two implications: (1) in the EU and the US, copyright in AI output without human creative contribution is uncertain; the parts that are clearly human (the spec design, the architecture, the reviews, the tests' intent) are not. This weakens nothing about publishing under Apache-2.0 (a permissive licence gives away what copyright there is), but it matters for §1's alternatives: a copyleft or source-available licence is only as strong as the copyright behind it. (2) The model providers' terms (Anthropic, Mistral) assign their output to the user, so there is no third-party claim to the code. Worth a sentence from the lawyer, not more.

## 4. The name: trademark and a trademark policy

**Decision:** clear "Smithable" against similar marks first (domains and the GitHub organisation are not clearance), then register the **word mark** for Åland IT AB, EUIPO classes 9 and 42 as the starting point (a professional sets the specification; selling plans does not by itself need class 35); the anvil separately once its design is settled; the US when expansion or protection priorities call for it, not automatically with a first US customer. EUIPO online fees: €850 for one class plus €50 for a second.

**What it implies:** the Apache licence does not grant the name, so a fork must not call itself Smithable. Write a short **trademark policy** (a page in the docs: you may say "built with Smithable", "compatible with Smithable"; you may not offer "Smithable hosting" or use the anvil; forks rename). Without a registration the policy has little behind it; with one, the hosted service's name is the one thing a competitor cannot take with the engine. The domains `smithable.ai` and `smithable.app` are already the user's.

## 5. The hosted service (not licences, but before real testers)

Settled in the handoff (§4): accounts are 18+ by self-declaration; the beta hosts apps and their test databases for testing and demos with synthetic data only, no production or sensitive data; no uptime SLA and data loss is possible; optional analytics only with a genuine opt-in that is never a condition of the free hosting (Johan still to confirm); strictly necessary storage needs no banner; no blanket "EU-only" or "not used for training" claim until each provider is verified. What the code must be checked for, and the drafts to write with placeholders (beta terms, privacy notice, DPA, operational checklist, an inventory of data flows and browser storage, a retention and deletion report) are Fable's next work; a lawyer familiar with the Swedish company and Åland reviews before launch.

- **Terms of service and a privacy policy** for smithable.ai and published apps on smithable.app: what a tester may publish, that a published app's content is theirs and their responsibility, data location (EU: AWS eu-north-1, Scaleway for mail), retention (demo sandboxes deleted after two hours; backups), what the AI gateway sends to which model provider (Mistral EU today; the frontier providers when escalated) and that prompts are not used for training (check each provider's terms; Mistral's API terms say so for paid use).
- **GDPR:** the service processes testers' Google identities and whatever their apps store. A short record of processing, a data-processing agreement for testers who publish apps with other people's data (the template DPA of each provider covers the sub-processors: AWS, Scaleway, Mistral, Cloudflare, Google), and a way to delete an account and its projects on request. The mail relay sends on the app owner's behalf: sender identification and a way to stop mail from a misused app are already in the relay's limits; the terms should say who is responsible for what is sent.
- **Payment and plans** (M16): a company entity, VAT handling, and the provider's terms (Stripe or similar) come with pricing, not before.
- **Customers outside the EU** (supplement of 30 September, in `smithable-cloud/docs/legal/international.md`): US customers are wanted, on the EU-hosted service as it is; who may sign up, where the data is and where people are stay three separate decisions, and nothing moves because of a customer's nationality. Before US onboarding: If's written cover for USA/Canada (the liability section excludes them; the cyber section says worldwide), a US-facing review of the terms and notice, and the tax and payment assessment before charging. The open-source code is worldwide from day one and needs none of this.
- **The maintenance boundary** (`smithable-cloud/docs/legal/maintenance-boundary.md`): Smithable maintains the platform, the kit and generated code and the security updates of hosted apps (the Sunday rebuilds, ARCHITECTURE §14.3); the customer maintains the app's logic, custom code and lawful data collection; vulnerability response names affected versions, tells owners, provides a fix and can stop a hosted app. Documents and code must draw the same line: owner notification by email, an affected-version lookup, a one-step stop and an advisories page are the service work it needs.

## 6. Order

1. Legal review of §1 and §2 (files in place: `LICENSE`, `KIT-LICENSE`, `NOTICE`), and the shadcn notice in generated apps.
2. Decide §3 A and B; change `NOTICE`/`KIT-LICENSE` if the holder changes; keep or replace the DCO in `CONTRIBUTING.md`.
3. File the trade mark (§4); write the trademark policy page.
4. Terms and privacy for the beta (§5) before uninvited testers; the rest with M16's pricing.
