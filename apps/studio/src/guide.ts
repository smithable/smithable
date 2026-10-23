// The Studio guide's stops (docs/design/studio-guide.md): each is shown beside the element that
// carries its `data-guide` name. One tour for each way of working; these tables are where the tours' words
// live, and what is translated when Studio gets a language. guide.test.ts holds them and the
// anchors together.

export interface Stop {
  /** The `data-guide` name of the element the card is beside. */
  anchor: string;
  title: string;
  text: string;
  /** The first stop asks how the person wants to work: No code goes on, Code switches to it. */
  choice?: boolean;
}

const NOCODE: Stop[] = [
  {
    anchor: "layout",
    title: "How do you want to work?",
    text: "No code: change your app in plain words and forms. Code: edit its definition as text. The bar chooses how many windows you see; the gear beside it, which window goes where.",
    choice: true,
  },
  {
    anchor: "preview",
    title: "Your app, running",
    text: "This is your app, running: click around as anyone would. What you change shows here at once. Choose Select above it and click a part to open its settings.",
  },
  {
    anchor: "behavior",
    title: "What it does",
    text: "Behavior is every setting of your app: its kinds of record, pages and actions, each opened when you need it. Who can and Content are beside it.",
  },
  {
    anchor: "change",
    title: "Ask agent Smith",
    text: "Ask Smith for a change or a question about the app. A change is checked and shown before it is kept.",
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
    text: "smithable.yml says what your app does; its companions say who may sign in, how it looks and what it says. Ctrl-Space, or What goes here?, lists what can be written at the cursor.",
  },
  {
    anchor: "problems",
    title: "Checked as you type",
    text: "A problem is named here and marked in the text. A save is one change, which can be undone like any other.",
  },
];

/** The tour of each first window: No code's starts by asking how, and its Code goes on with Code's. */
export const TOURS = { nocode: NOCODE, code: CODE };

/** The key that says this browser has seen the tour for this app. */
export const doneKey = (app: string) => `guideDone:${app}`;

/** Whether the address turns the tour off (the screenshot scripts and most of the tests). */
export const guideOff = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("guide") === "off";
