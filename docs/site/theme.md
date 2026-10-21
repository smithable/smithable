# Make a theme

A theme is how an app looks: its colors in light and dark mode, its fonts, how headings, cards, buttons, pictures and tables are drawn, its corners, shadows, spacing and motion. It is a small file of values, never CSS, so any theme works on any app and switching back is always safe.

This page makes a theme of its own for the booking starter, first as a file and then in the theme lab. Every command below was run for real on a new booking app, and the answers are shown as they came back.

## 1. The themes there are

```console
$ smithable new harbour --starter booking
$ cd harbour
$ smithable themes
modern           built in  Inter, 10px corners
minimal          built in  Inter, 6px corners
playful          built in  Nunito Sans, 16px corners
…
restaurant       built in  Source Sans 3, 6px corners
street-food      built in  DM Sans, 0px corners
cafe             built in  Nunito Sans, 16px corners
Add your own as themes/<name>.yml: see docs/spec/v0.1.md, Themes.
```

Sixteen are built in, each in light and dark; the [spec reference](../spec/v0.1.md#themes) says what each looks like. `smithable op setTheme --preset cafe` uses one, and `smithable undo` takes it back.

## 2. Write the file

A theme needs three colors per mode: the background, the text on it and the primary color for buttons and links. Smithable derives the other twenty-five (cards, borders, muted text, the charts) from those. Everything else has a default, so a theme names only what it changes. This one is for a harbour's boat trips, with serif headings in capitals over a plain sans:

```yaml
# harbour.yml
smithableTheme: 0.1
name: harbour
fonts:
  body: DM Sans
  heading: Source Serif 4
headings: { weight: 600, tracking: tight, scale: large, case: upper }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: pill, weight: bold }
radius: 10px
shadow: none
light:
  primary: "#1e4e79"
  background: "#f4f6f8"
  foreground: "#14202b"
dark:
  primary: "#8db8e0"
  background: "#0f1720"
  foreground: "#e3e9ef"
```

The fields and their values are in the spec reference's [Themes](../spec/v0.1.md#themes) section: seven fonts, and for headings, surfaces, buttons, pictures and tables a few choices each.

## 3. Add it

```console
$ smithable op addTheme harbour --text @harbour.yml --use
The theme is refused:
  themes/harbour.yml:6:11  error  Headings in capitals need normal or wide tracking: tight capitals run together.
```

A theme is checked before it is added, as the built-in ones are. With `tracking: wide` it goes in:

```console
$ smithable op addTheme harbour --text @harbour.yml --use
Generated 182 files (1 changed, 0 removed).
Add theme harbour and use it. Undo with: smithable undo
```

The file is now `themes/harbour.yml` in the project, `smithable.ux.yml` says `theme: { preset: harbour }`, and `smithable themes` lists it under the built-in ones as `themes/`. Without `--use`, the theme is only added, and `smithable op setTheme --preset harbour` uses it later.

The check also measures every pair of colors the app puts together. Give the light mode a pale grey for its text, and nothing is added:

```console
$ smithable op addTheme harbour-pale --text @pale.yml
The theme is refused:
  themes/harbour-pale.yml:12:3  error  In "light", foreground on background is 2.8:1; it needs 4.5:1 to read.
  themes/harbour-pale.yml:12:3  error  In "light", card-foreground on card is 3.0:1; it needs 4.5:1 to read.
  …
```

Text needs 4.5:1 against what it sits on, and the focus ring 3:1, so a theme that is accepted is readable in both modes.

## 4. Or make it in the theme lab

The lab is also [on this site](https://docs.smithable.ai/theme-lab/index.html), with nothing to install: the same controls on every starter's pages as they were when this version of Smithable was released, and **Download** in place of Save; add the file with `addTheme`, as in step 3. Locally, it shows a running app and saves into the project:

```console
$ smithable theme lab --project .
Making the lab's app (a booking app with every control)…
The theme lab is at http://localhost:4330 (the app at http://localhost:4331). A theme saved goes to the project …, through addTheme. Ctrl+C stops it.
```

The lab opens in the browser beside a real app: by default a booking app with a field for every kind of control. **Starter** at the top makes another starter's app in its place (a few seconds), so a theme is judged on the kind of app it is for; `--starter crm` starts with that one. On the left are the theme's fields, grouped as the file is. In the middle, one of the app's pages is shown at full size: the landing page, a list, its form or a record, each chosen by its tab, in light or in dark. The width buttons (phone 390, tablet 820, laptop 1280, desktop 1600) set the frame's width, and its edge drags to any width in between. The frame is scaled down only when the window is narrower than the width. **Phone beside** shows the phone's width next to it. At the bottom is the theme file itself as text. A change to a control or to the text shows in the frame at once, with no regeneration in between.

- **Start from** any of the built-in themes or the project's own, then rename it.
- **Phone** shows the pages at a phone's width. **Greyscale** takes the color out: if two themes still look different without it, they are two designs and not one design in two colors.
- **Show the motion** plays the landing page once, with the theme's motion: `none`, `subtle` or `lively`.
- Under the pages, a line for each look the app can ask for says whether the theme suits it ("flat cards on this background have no edge"), and the check's errors are shown in red.
- **Save** adds the theme to the project through `addTheme`, as above, so it is one change like any other and `smithable undo` takes it back. Without `--project`, inside a project folder the lab saves to that project, and anywhere else it writes `themes/<name>.yml` into the current folder.

### The pages as files

For a look at an app's pages with nothing running (a folder to send a tester, pictures in seconds), `smithable static` saves them: every page without its scripts, the kit's CSS as one sheet, the pictures and fonts beside it, signed in as a role (`--as visitor` for the public pages), and an index page that shows them in light and dark at a desktop's, a laptop's, a tablet's and a phone's width:

```console
$ smithable static . --states
Starting the app at http://localhost:41283…
Saved 22 pages and 14 files into …/data/static (as admin). Open …/data/static/index.html.
```

`--states` adds a list with nothing found, a form with its errors and a record's delete dialog. The pages are the look only: their links and forms lead nowhere. The command needs Playwright, which the app's own smoke test has.

## 5. A theme for the landing page alone

The landing page has a frame of its own, so it may look different from the rest of the app:

```console
$ smithable op setTheme --page home --preset street-food
Generated 182 files (1 changed, 0 removed).
Use the Street-food theme on the home page. Undo with: smithable undo
```

`smithable.ux.yml` now gives the page `home` the theme `street-food`, and every other page keeps the harbour theme. Only a landing page can have its own theme: a list page in another theme would look like another app. With `--page`, `--primary`, `--background`, `--font`, `--density` and `--motion` change one value for that page alone, and `none` gives it back the app's.

## Taking it back

Each `addTheme` and `setTheme` is a Git commit, so `smithable undo` takes back the last one. A theme you no longer use can stay in `themes/`: it changes nothing until a ux file names it.
