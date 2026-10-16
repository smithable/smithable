// The Studio guide's stops (docs/design/studio-guide.md): each is shown beside the element that
// carries its `data-guide` name. One tour for each mode; these tables are where the tours' words
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

const BUILDER: Stop[] = [
  {
    anchor: "mode",
    title: "How do you want to work?",
    text: "No code: change your app in plain words and forms. Code: edit its definition as text, with every change also as a form. You can switch here at any time.",
    choice: true,
  },
  {
    anchor: "preview",
    title: "Your app, running",
    text: "This is your app, running: click around as anyone would. What you change shows here at once.",
  },
  {
    anchor: "summary",
    title: "What it does",
    text: "Your app in plain words, kept true as it changes. Click a sentence to change that part; the buttons add a record, a page, an action.",
  },
  {
    anchor: "details",
    title: "Details",
    text: "Choose Select above the preview and click a part of the app, or click a sentence in What it does: its details and forms open here. With nothing chosen, here are the app's own details.",
  },
  {
    anchor: "change",
    title: "Change it in your own words",
    text: "In Ask, describe a change or ask a question about the app. A change is checked and shown before it is kept; the thread says what each one changed, and every change can be undone. Ask docks right of the preview or under it.",
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

const STUDIO: Stop[] = [
  {
    anchor: "files",
    title: "Your app as text",
    text: "smithable.yml says what your app does; its companions say who may sign in, how it looks and what it says. Ctrl-Space, or What goes here?, lists what can be written at the cursor.",
  },
  {
    anchor: "problems",
    title: "Checked as you type",
    text: "A problem is named here and marked in the text. Save keeps the file as one change, which can be undone like any other.",
  },
  {
    anchor: "concepts",
    title: "Every part of your app",
    text: "Its records, actions and pages, with their rules and the files each became. Pick one: its details open beside, and Show in smithable.yml takes you to its lines.",
  },
  {
    anchor: "operation",
    title: "Every change as a form",
    text: "Pick an operation and fill in its form; the line under it is the same change for a terminal.",
  },
  {
    anchor: "changes",
    title: "Every change, and what it did",
    text: "Describe a change here as in No code. Each change names the files it touched and opens as their patch; an edit in Files saves itself after a pause. Ctrl+Z takes any change back.",
  },
];

/** The tour of each mode: Builder's starts by asking which mode, and its Code goes on with Code's. */
export const TOURS = { builder: BUILDER, studio: STUDIO };

/** The key that says this browser has seen the tour for this app. */
export const doneKey = (app: string) => `guideDone:${app}`;

/** Whether the address turns the tour off (the screenshot scripts and most of the tests). */
export const guideOff = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("guide") === "off";
