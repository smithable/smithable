# How a starter is made

Status: 2026-10-03, by Fable, after a day in which every large finding came from using the product the way a person would (the tester journeys, the first-build benchmark) and none from writing YAML by hand.

A starter is an app someone can begin from, an example of what Smithable makes, and (since first builds take a starter as their example) a pattern the model copies. The six so far were written by hand. From the seventh on, a starter is made with the product and has to pass the list below.

## 1. The way it is made

1. **From a sentence.** Someone builds it on the hosted service or with `smithable new --describe`, then changes it only through Studio and operations. The first one made this way is the company website, built by Johan as the first usability test with a person.
2. **Every place where that fails is written down** while building: what the first build got wrong, what no operation or Studio control could change, what had to be guessed, what looked wrong, what took too long. Each item becomes an engine or Studio fix, or evidence for a construct (ARCHITECTURE §2.4, to Fable). A starter that needed hand edits to its YAML names them in its pull request.
3. **Then it is polished:** real sample records and texts, pictures from the library, the entry on the Starters page.
4. **It becomes a showcase site** once it passes.

## 2. What it has to pass

- **Valid and quiet:** no errors and no warnings, except `example-admin` for its sample administrator on `.example`.
- **No sample left in a new project:** its administrator and any `allowedDomains` are on `.example`, so `smithable new` replaces or removes them.
- **Sign-in by email code**, and what visitors see without signing in is said in `public`.
- **Custom code only where it needs code.** State changes are standard actions. If it has a custom action, page or section, the file and its test ship with it, and an app drafted from the starter works without them.
- **Samples that read as real:** `samples/<Model>.yml` for every model, with texts a person would write, and pictures where the model has them. No "Item 8".
- **Texts in the content file** for every page title, landing section and label that the default would get wrong.
- **In the gate:** an entry in `test-apps` with a browser flow of what the app is for (not only that pages open), and the generated access and smoke tests green.
- **Looked at:** the visual pass in light and dark, at desktop and phone width: the landing page, the main list, a record, a form, an empty list, a long title, a missing picture.
- **A first build keeps it:** two descriptions from its territory in the benchmark, and the scorecard shows the draft keeping its models and actions, the right access, and none of its sample names.
- **Shown:** two pictures and a paragraph on the Starters page; `--starter <name>` in the help and the hosted form.

## 3. Which comes next

The company website (ROADMAP, candidate milestone): mostly content, pages built from sections, a few small models (news, services, people, a contact form), almost no sign-in. After it, whichever kind of app the benchmark's wide set shows first builds handling worst.
