// The Studio guide's stops (docs/design/studio-guide.md): each is one of Smith's lines in his
// thread, with the element that carries its `data-guide` name lit (smith-first.md §7; a card
// beside it on a phone). One tour for No code and one for Code; these tables are where the tours'
// words live, in Smith's voice, and what is translated when Studio gets a language.
// guide.test.ts holds them and the anchors together.

export interface Stop {
  /** The `data-guide` name of the element the card is beside. */
  anchor: string;
  title: string;
  text: string;
}

const NOCODE: Stop[] = [
  {
    anchor: "preview",
    title: "Your app, running",
    text: "This is your app, running: click around as anyone would. What you change shows here at once. Choose Select above it and click a part to open its settings.",
  },
  {
    anchor: "manual",
    title: "By hand",
    text: "Here you can change the app by hand: No code, in plain words and forms, or Code, the definition itself as text.",
  },
  {
    anchor: "behavior",
    title: "What it does",
    text: "Behavior is every setting of your app: its kinds of record, pages and actions, each opened when you need it. Who can and Content are beside it.",
  },
  {
    anchor: "change",
    title: "Ask me",
    text: "Ask me for a change or about the app. I check a change and show it to you before it is kept.",
  },
  {
    anchor: "changes",
    title: "Every change, in words",
    text: "Changes lists what was done, however it was made, and every change can be undone.",
  },
  {
    anchor: "look",
    title: "The look",
    text: "Colors, type, the app's language and how lists and forms are laid out: the look is separate from what the app does.",
  },
  {
    anchor: "publish",
    title: "Publish and share",
    text: "When it does what you want, publish it: an address people can open, with sign-in and backups. Until then, nothing leaves this page.",
  },
];

const CODE: Stop[] = [
  {
    anchor: "files",
    title: "Your app as text",
    text: "smithable.yml says what your app does; its companions say who may sign in, how it looks and what it says. Ctrl-Space, or the question mark above it, lists what can be written at the cursor.",
  },
  {
    anchor: "problems",
    title: "Checked as you type",
    text: "A problem is named here and marked in the text. A save is one change, which can be undone like any other.",
  },
];

/**
 * The tour of the view's open sub-tab: No code's walks every window, Code's the editor. Nobody
 * is asked to choose between them (smith-first.md §7).
 */
export const TOURS = { nocode: NOCODE, code: CODE };

/** The key that says this browser has seen the tour for this app. */
export const doneKey = (app: string) => `guideDone:${app}`;

/** Whether the address turns the tour off (the screenshot scripts and most of the tests). */
export const guideOff = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("guide") === "off";
