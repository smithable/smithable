// The Studio guide's stops (docs/design/studio-guide.md): each is shown beside the element that
// carries its `data-guide` name. This table is where the tour's words live, and what is
// translated when Studio gets a language. guide.test.ts holds it and the anchors together.

export interface Stop {
  /** The `data-guide` name of the element the card is beside. */
  anchor: string;
  title: string;
  text: string;
  /** The first stop asks how the person wants to work: No code goes on, Code switches to it. */
  choice?: boolean;
}

export const STOPS: Stop[] = [
  {
    anchor: "mode",
    title: "How do you want to work?",
    text: "No code: change your app in plain words and forms. Code: edit its definition as text, with every change also as a form. You can switch here at any time.",
    choice: true,
  },
  {
    anchor: "preview",
    title: "Your app, running",
    text: "This is your app. The records in it are samples for trying it; your published app starts empty.",
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
    text: "Describe a change, or ask a question about the app. A change is checked and shown before it is kept, and every change can be undone.",
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

/** The key that says this browser has seen the tour for this app. */
export const doneKey = (app: string) => `guideDone:${app}`;

/** Whether the address turns the tour off (the screenshot scripts and most of the tests). */
export const guideOff = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("guide") === "off";
