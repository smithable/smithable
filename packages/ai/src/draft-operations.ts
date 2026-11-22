// The first draft as a batch of operations (docs/design/first-build.md, 2.7; ARCHITECTURE §9):
// the model starts from an empty app and answers with operations, constrained to each
// operation's own argument schema, so the spec's grammar cannot go wrong. The operations are
// applied one by one; the one that fails goes back to the model with its reason, and the model
// answers with that one corrected and the rest.
import {
  type AnyOperation,
  applyOperation,
  type Language,
  type OperationArgs,
  operationsFor,
  type ProjectFiles,
  pageAccess,
  pageModels,
  sensitiveKind,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import type { Assumption, Draft, SpecFiles } from "./draft.js";
import { completeDraftJson } from "./draft-json.js";
import { LANGUAGE_NAMES, languageNote, otherLanguages, textLanguage } from "./language.js";
import { plainSchema } from "./propose.js";
import { type Provider, REPAIRS, type Usage } from "./provider.js";

/** An app with nothing in it yet: what the operations start from. */
export const BLANK: SpecFiles = {
  "smithable.yml": "smithable: 0.1\napp:\n  name: App\n",
  "smithable.auth.yml":
    "smithableAuth: 0.1\nsignIn:\n  providers: [email]\ndefaultAccess: private\nroles:\n  admin: all\n  member: { pages: all, create: all }\nassistant:\n  for: signed-in\n",
  "smithable.content.yml": "smithableContent: 0.1\n",
  "smithable.ux.yml": "smithableUx: 0.1\n",
};

/**
 * The empty app a draft starts from, with the starter's default access (a team's starter is
 * shared, a members' one private) so a draft that says nothing about access gets the right one.
 */
export function blankFor(starter?: SpecFiles): SpecFiles {
  const access = /^defaultAccess:\s*(shared|private)\b/m.exec(
    starter?.["smithable.auth.yml"] ?? "",
  );
  return access
    ? {
        ...BLANK,
        "smithable.auth.yml": (BLANK["smithable.auth.yml"] as string).replace(
          "defaultAccess: private",
          `defaultAccess: ${access[1]}`,
        ),
      }
    : BLANK;
}

/** Operations a first draft never needs: they change or undo what a draft has not made yet. */
const NOT_FOR_DRAFTS = new Set([
  "editSpec",
  "removeField",
  "renameField",
  "changeField",
  "removePage",
  "setRuleId",
  "setPackage",
  // A draft has no files of its own: its mark comes from the image library afterwards.
  "setLogo",
]);

export function draftOperations(): AnyOperation[] {
  return operationsFor([]).filter((op) => !NOT_FOR_DRAFTS.has(op.name));
}

const draftGuidance = (
  sourceWording: string,
) => `You design the first version of a web app as a list of Smithable operations, applied in order to an empty app. Smithable generates the whole app from the result.
Order: setApp (name, one-sentence description, currency, timezone); addModel for each kind of record with its fields; addPage for the records people manage (one crud page per model, the first page is the app's start); addLandingPage only for an app with public visitors (it already has a hero and a footer; addSection adds other sections, and ${sourceWording}), and with it addPrivacyPage (a privacy page written from the app; the operator's details come later); addDataPage or addUsersPage only for administrators' tools; setDefaultAccess only to change the access the app starts with (shared: a team works on the same records; private: each person sees only their own); setRoles when the app has more than one kind of user, then grant for each role (pages, create, write, delete, actions: "all" or a list; the member role already opens every page and adds every kind of record, so grant it less when the description says so, e.g. { role: "member", what: "create", names: ["Booking"] }); setOwner when a record belongs to someone other than whoever created it ("each customer has an account manager", "the salesperson who handles the order": add a field that refers to User, then setOwner with it, and "owner" in the access means that person); setPublic for what visitors may open, read or create; setTheme for the look; setText for the landing page's texts; addAction with "on", "set" and usually "when" for a button that moves a record to its next state (resolve an incident, mark an invoice paid, cancel a booking), e.g. { action: "resolve", on: "Incident", when: { status: "investigating | identified" }, set: { status: "resolved", resolvedAt: "NOW()" }, add: { "IncidentUpdate.at": "NOW()", "IncidentUpdate.status": "resolved", "IncidentUpdate.message": "" } }: "add" also creates a related record (a model that refers to this one), and an empty value asks the person for it when they press the button; "copy" (with "with" for its lists) makes a new record from this one ("duplicate invoice"), and "ME()" sets a User field to whoever presses the button ("take ticket"). Never add a custom action (one without "on") unless the description asks for something only code can do: it does nothing until someone writes its code. Booking a place needs no action: the booking refers to what is booked ("session: Session!", with "unique" only when bookings are private, as in the booking starter, where it means one place per person; in a shared app "unique" would allow one booking per session in all) and setCapacity limits the bookings per session to its places ("session.capacity"); the Book button and the places left come with it. A "when" compares choice and yes/no fields only, never numbers. addOutgoing only when the description says someone is told of something ("send a confirmation when a booking is made", "mail the customer when the order ships"): { outgoing: "bookingMade", when: "Booking created", recipient: "owner" } (when: "<Model> created | changed | deleted" or an action's name; recipient: "owner", a role, an email field, or one reference away as "customer.email"; "where" for "becomes shipped"). setRecordList with look "thread" for a record with messages under it (replies, comments or notes: a model with a long text field and a reference back, listed on the record as "Message[]"), e.g. { page: "cases", field: "messages", look: "thread" }: the record's page shows them as a conversation with a reply box, so they need no page of their own.
When a starter is given, it is the example of shape and naming for this kind of app: reuse its models, fields, pages, standard actions (those with "on"; never its custom ones), roles and access that fit the description, under the same names, leave out what does not fit, and add what the description needs. The app already starts with the starter's default access. A role opens only the pages and adds only the records its grants name, and changes or deletes only its own records unless granted "write" or "delete" on a model: grant as the starter does, and as the description says. The starter's app name, its people, places and texts are sample content: never reuse them.
Select a footer's contact band with setSectionLook, key layout and value contactBand, only when the description asks for a footer with contact details or opening hours, or the source has that footer shape. Enter those details once in the landing page's contact section, so the footer can use them.
Use a logo instead of the visible hero title only when the description or the source's layout calls for it: setSectionLook with key mark and value logo. Use pictures behind text, call to action, or features sections, or on features items, only when the description or source's layout calls for that treatment and the input provides a known app-relative picture file. Never guess an image path or attach a picture from an unrelated section.
