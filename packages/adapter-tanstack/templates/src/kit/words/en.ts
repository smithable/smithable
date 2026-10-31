// Smithable app kit: every word the app says by itself, in English. An app carries one language:
// the generator writes the file of the content file's `language` as src/kit/words.ts, so
// `w.save` is a plain import everywhere. A phrase that takes a name is a function, since each
// language builds its sentence its own way. Another language is a file beside this one with the
// same keys (`satisfies Words` keeps them complete). The maker's own texts (labels, titles,
// help) are not here: they live in the content file.

export const w = {
  accept: "Accept",
  addFiles: "Add files",
  addOne: (label: string) => `Add ${label}`,
  addYourName: "Add your name",
  admin: "Admin",
  aFirstCall: "A first call:",
  actAs: "Act as",
  actions: "Actions",
  active: "Active",
  sampleUser: "Sample user",
  activeFilters: "Active filters",
  activity: "Activity",
  activityLead: "Who did what, and when. Kept 12 months; the client's details 90 days.",
  addPictures: "Add pictures",
  adding: "Adding…",
  address: "Address",
  ai: "AI",
  // Said at the assistant's first interaction (legal-1.0 U6, the AI Act's Article 50).
  aiNotice: (to: string) =>
    `AI assistant — answers may be wrong. Your question and relevant records you are allowed to access may be sent to ${to}. Do not include prohibited sensitive information.`,
  aiIn: (provider: string, region: string) => `${provider} in ${region}`,
  aiConfigured: "the AI service this app is set up with",
  aiGenerated: "AI-generated",
  aiMayBeWrong: "Answers may come from an AI and can be wrong. Check what matters.",
  all: "All",
  any: "Any",
  anything: "Anything",
  apiIsAt: "The API is at",
  appearance: "Appearance",
  appearanceDark: "Dark",
  appearanceLight: "Light",
  appearanceSystem: "System",
  approve: "Approve",
  approved: "Approved",
  areRequired: "are required.",
  as: "As",
  ask: "Ask",
  askPlaceholder: "How many … ? Show the … that …",
  askTheApp: "Ask the app",
  asking: "Asking…",
  awaitingReview: "Awaiting review",
  belongTo: (count: number, noun: string, name: string) =>
    `${count} ${noun} ${count === 1 ? "belongs" : "belong"} to ${name}.`,
  bookAPlace: "Book a place",
  booking: "Booking…",
  bookingClosed: "Booking for this has closed.",
  bookUntil: (when: string) => `Book until ${when}.`,
  bookingClosedAt: (when: string) => `Booking closed at ${when}.`,
  cancelUntil: (when: string) => `Cancel until ${when}.`,
  cancellingClosedAt: (when: string) => `Cancelling closed at ${when}: contact us to change it.`,
  cancel: "Cancel",
  cancelBooking: "Cancel booking",
  cancellingClosed: "It is too late to cancel this: contact us to change it.",
  cancelYourBooking: "Cancel your booking?",
  cannotBeUndone: "This cannot be undone.",
  changes: "changes",
  chooseLengthFirst: "Choose what to book first.",
  chooseTime: "Choose a time",
  day: "Day",
  findingTimes: "Looking for free times…",
  noFreeTimes: "No free times this day.",
  notFree: (times: string) =>
    times
      ? `That time is not free. Free that day: ${times}.`
      : "That time is not free, and that day has no other.",
  notInCalendar:
    "This is not on the calendar shown, or you cannot see it. Close this and choose another.",
  tooLateToCancel: "It is too late to cancel here: contact us to change it.",
  editsWillBeLost: "What you entered on this form is not saved.",
  fieldsToFix: (n: number) => (n === 1 ? "1 field to fix:" : `${n} fields to fix:`),
  keepEditing: "Keep editing",
  leaveWithout: "Leave without saving",
  leaveWithoutSaving: "Leave without saving?",
  trashKeepsIt: "It stays in the trash for 30 days, where it can be restored.",
  checkingPlaces: "Checking places…",
  chooseFile: "Choose a file",
  choosePicture: "Choose a picture",
  choosePictures: "Choose pictures",
  chooseSomeone: "Choose someone",
  close: "Close",
  closeMenu: "Close menu",
  code: "Code",
  codeKept:
    "The preview sends no mail: the code is in Studio's Outbox. Or sign in with a role below (development only).",
  codeOnItsWay: "may sign in, a code is on its way. It works for ten minutes.",
  confirm: "Confirm",
  consentText:
    "This app would like to use cookies or similar to count visits or show content from other services. Nothing is used before you accept.",
  consentTitle: "Cookies",
  contactUs: "Contact us",
  cookieSettings: "Cookie settings",
  copied: "Copied",
  copy: "Copy",
  copyKeyNow: "Copy the key now: it is not shown again.",
  copyLink: "Copy link",
  couldNotSendCode: "Could not send a code.",
  couldNotSignIn: "Could not sign in. Please try again.",
  cover: "Cover",
  decline: "Decline",
  delete: "Delete",
  deletedByColumn: "Deleted by",
  deletedOn: "Deleted on",
  describedAt: "described at",
  developmentOnly: "Development only",
  developmentOnlyNote: "Only available in development.",
  done: "Done.",
  downloadDescription: "Download the description",
  edit: "Edit",
  email: "Email",
  emailAddress: "Email address",
  emptyTrash: "Empty trash",
  emptyTrashConfirm: (n: number) =>
    `Remove ${n === 1 ? "the record" : `all ${n}`} in the trash for good? This cannot be undone.`,
  enterNumber: "Enter a number",
  enterValidDate: "Enter a valid date",
  enterValidDateTime: "Enter a valid date and time",
  enterValidEmail: "Enter a valid email address",
  enterValidPhone: "Enter a valid phone number",
  enterValidUrl: "Enter a valid web address",
  enterWholeNumber: "Enter a whole number",
  errorTitle: "Something went wrong",
  everyone: "Everyone",
  exportCsv: "Export CSV",
  exportedSome: (shown: number, total: number) =>
    `Exported ${shown.toLocaleString("en")} of ${total.toLocaleString("en")} matching records`,
  fieldsMarked: "Fields marked",
  fileKinds: "Choose a PDF, a document, a spreadsheet, a text or a picture.",
  fileNotAdded: "The file could not be added.",
  fileNotUploaded: "This file was not uploaded here, or too long ago: choose it again.",
  storageFull: "There is no room left for files in this app. Ask its owner.",
  fileTooLarge: "The file is too large (at most 10 MB).",
  footer: "Footer",
  forgetInLog: "Forget in the log",
  from: "From",
  fromYourRecords: "From your records",
  full: "Full",
  giveThemTo: "Give them to",
  history: "History",
  if: "If",
  inspectorPlaceholder: "How many … are there? Show the … that …",
  inTrash: (at: string, by: string | null, until: string) =>
    `In the trash since ${at}${by ? `, deleted by ${by}` : ""}. It is removed for good on ${until}.`,
  invitationExpired: "Invitation expired",
  invitationLinkCopied: "Invitation link copied.",
  invitations: "invitations",
  invitedNameLater:
    "An invited person chooses the name others see after signing in: their name at the bottom of the menu.",
  keepIt: "Keep it",
  keys: "Keys",
  keysInPreview:
    "In the preview a key works only on this computer: other programs and assistants reach the app with it once it is published.",
  keysLead:
    "For other programs that use this app's API. A key acts with its role and owns nothing.",
  keptInPreview: "kept a mail in the preview (published, it would have been sent)",
  skippedInPreview: "skipped a call in the preview (published, it would have been made)",
  lastPlaceTaken: "Sorry, the last place was just taken.",
  leaveThisEmpty: "Leave this empty",
  less: "Less",
  loading: "Loading…",
  makeAKey: "Make a key",
  menu: "Menu",
  message: "Message",
  messageKept: "Your message is in the preview's outbox, not sent: the preview sends no mail.",
  messageNotSent: "The message could not be sent.",
  messageSent: "Your message is sent.",
  modelNotReached: "The model could not be reached.",
  month: "Month",
  /** The language switch of an app in several languages. */
  language: "Language",
  /** A person filter's chips (record-rules.md §6): the viewer, and nobody. */
  mine: "Mine",
  unassigned: "Unassigned",
  more: "More",
  moreArticles: "More articles",
  moreBelow: "More below",
  movedToTrash: (title: string) => `“${title}” is in the trash.`,
  moveToTrash: "Move to trash",
  // Deleting a record that others point to (docs/design/delete-together.md).
  moveAllToTrash: "Move all to the trash",
  /** "Move “Arctic Outdoor Co” to the trash?" (`what` is the quoted title, or thisOne). */
  moveToTrashAsk: (what: string) => `Move ${what} to the trash?`,
  /** "3 orders and 12 order lines go with it; they are restored together." */
  goesWith: (list: string, n: number) =>
    `${list} ${n === 1 ? "goes" : "go"} with it; ${n === 1 ? "it is" : "they are"} restored together.`,
  /** "5 notes will show no customer." */
  reject: "Reject",
  rejected: "Rejected",
  rejectedBecause: (reason: string) => `Rejected by a reviewer: ${reason}`,
  rejectReason: "Why (shown to the person who sent it)",
  reviewDecided: "Decided in the last 30 days",
  reviewEmpty: "Nothing waits for review.",
  reviewLead:
    "Pictures and files people sent, waiting until someone approves them. Others see them once they are approved.",
  reviewMailSubject: (n: number, app: string) =>
    `${n === 1 ? "A file awaits" : `${n} files await`} review in ${app}`,
  reviewMailText: (n: number, link: string) =>
    `${n === 1 ? "A picture or file someone sent waits" : `${n} pictures and files people sent wait`} for your review before others see them.\n\n${link}\n`,
  reviewRejectSure:
    "Reject it? The file is removed, and the reason is shown to the person who sent it.",
  sentBy: (who: string, when: string) => `Sent by ${who}, ${when}`,
  virusRefused: "This file was refused by the virus check.",
  willShowNone: (list: string, label: string) => `${list} will show no ${label.toLowerCase()}.`,
  cannotDeleteUsed: (title: string, list: string) =>
    `“${title}” is used by ${list}, so it cannot be deleted.`,
  turnTrashOn: (models: string) => `Turn the trash on for ${models} to delete them together.`,
  /** "3 orders", "1 order". */
  nOf: (n: number, one: string, many: string) => `${n} ${(n === 1 ? one : many).toLowerCase()}`,
  /** "a, b and c". */
  listed: (items: string[]) =>
    items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`,
  whatBelongsToThem: "what belongs to them",
  /** A member of a group in the trash: "with “Arctic Outdoor Co”". */
  withRoot: (title: string) => `with “${title}”`,
  /** A root with members in the trash: "and 15 records". */
  andRecords: (n: number) => `and ${n} ${n === 1 ? "record" : "records"}`,
  togetherColumn: "Together",
  restoreRootFirst: (label: string, title: string) =>
    `Restore the ${label.toLowerCase()} “${title}” first: this record went to the trash with it.`,
  noRightToDelete: (label: string) =>
    `Some ${label.toLowerCase()} records are not yours to delete, so nothing was moved.`,
  name: "Name",
  namedAs: (count: number, noun: string, name: string, field: string) =>
    `${count} ${noun} ${count === 1 ? "has" : "have"} ${name} as ${field}.`,
  newerArticles: "Newer articles",
  newestFirst: "Newest first",
  next: "Next",
  nextPicture: "Next picture",
  no: "No",
  noActivityInPeriod: "No activity in this period.",
  nobodyLeaveEmpty: "Nobody (leave them empty)",
  noModelToAsk: "The app's assistant has no model yet to answer this; ask whoever runs the app.",
  noPlacesLeft: "No places left.",
  nobodyYet: "Nobody yet. Invite the first person above.",
  notAllowed: "You are not allowed to do this.",
  notDone: "Not done.",
  notFound: "Not found",
  notFoundNote: "This page or record does not exist, or you cannot see it.",
  notRun: "Not run: a change the person would confirm first.",
  nothing: "Nothing",
  nothingHereYet: "Nothing here yet.",
  /** Signed in with no page of the app to open (the app's start page). */
  noPageForYou: "There is no page here for your role yet. An administrator can change that.",
  nothingMatches: "Nothing has happened that matches.",
  nothingThisMonth: "Nothing this month yet.",
  nothingThisWeek: "Nothing this week yet.",
  nothingToChooseYet: "There is nothing to choose yet.",
  nothingToPreview: "Nothing to preview.",
  olderArticles: "Older articles",
  openIt: "Open it",
  openMenu: "Open menu",
  openingHours: "Opening hours",
  otherArticles: "Other articles",
  pages: "Pages",
  person: "Person",
  phone: "Phone",
  pictureKinds: "Choose a picture (JPEG, PNG, WebP or HEIC).",
  pictureNotAdded: "The picture could not be added.",
  pictureNotRead: "The picture could not be read.",
  pictureRefused: "The picture was refused.",
  pictureTooLarge: "The picture is too large (at most 1 MB).",
  pictureTooWide: (side: number) =>
    `The picture is too large (at most ${side} pixels on its longest side).`,
  preview: "Preview",
  previous: "Previous",
  previousPicture: "Previous picture",
  privacy: "Privacy",
  proposedNote: "Shown to the person to confirm; nothing is changed yet.",
  /**
   * Ask's small talk (A 152): a greeting, thanks or "what can you do" answered by rule, with no
   * model, and questions to try that lead back to the app's records.
   */
  chatGreeting: /^(?:hi|hello|hey|hiya|howdy|good (?:morning|afternoon|evening|day))$/,
  chatThanks: /^(?:(?:many )?thanks|thank you|thx|ty|cheers)(?: (?:so|very) much| a lot)?$/,
  chatHow: /^(?:how are you(?: doing| today)?|how's it going)$/,
  chatWho: /^(?:who are you|what are you|what can you do|what do you do|help|what can i ask)$/,
  chatBye: /^(?:bye|goodbye|see you|that's all|no thanks)$/,
  chatOk: /^(?:ok|okay|cool|nice|great|good|perfect)$/,
  chatHello: "Hello! Ask me about the records you can see here.",
  chatWelcome: "You're welcome! Anything else you'd like to know?",
  chatWell: "I'm well, thank you. What would you like to know?",
  chatAbout:
    "I answer questions about the records you may see here: how many there are, which ones, and what they add up to.",
  chatGoodbye: "Bye for now.",
  chatNext: "Good. What would you like to know next?",
  tryAsking: "Try asking:",
  howManyAre: (plural: string) => `How many ${plural} are there?`,
  perField: (plural: string, field: string) => `${plural} per ${field}`,
  /** Ask's answer checks (ask-checks.md §3): a claim that a change was made, or that there is none. */
  doneWords:
    /\b(?:I(?:'ve| have)? (?:added|changed|renamed|updated|marked|created|deleted|removed|saved|moved)|(?:has|have) been (?:added|changed|renamed|updated|marked|created|deleted|removed|saved|moved))\b|^done\b/im,
  noneWords:
    /\b(?:none|nothing|no such|not any|zero|there (?:are|is|were|was) no)\b|(?:^|[.!?]\s+)no \p{L}+(?: \p{L}+)?s\b|\bno \p{L}+(?: \p{L}+)? (?:found|matches|match)\b/imu,
  notConfirmed:
    "This answer could not be confirmed from the app's records: check it against the results below.",
  readAloud: "Read aloud",
  records: "Records",
  remove: "Remove",
  removeUser: "Remove user",
  removedUserNote: "They can no longer sign in. They can be invited again.",
  replace: "Replace",
  required: "Required",
  resend: "Resend",
  restore: "Restore",
  restoreData: "Restore data…",
  results: "Results",
  revoke: "Revoke",
  role: "Role",
  rulesStillAnswer: "Questions the rules read are still answered.",
  saveChanges: "Save changes",
  /** The question before saving a change that mails people (a session moved). */
  saveTheChange: "Save the change?",
  /** Who a change tells: one mail per record of the list, and how many ("each of its bookings (3)"). */
  eachIsTold: (n: number, label: string) =>
    `The change is mailed to each of its ${label.toLowerCase()} (${n}).`,
  saved: "Saved",
  saving: "Saving…",
  search: "Search…",
  searchAction: "Search",
  selectAll: "Select all",
  /** The reply box of a conversation (docs/design/conversation.md). */
  reply: "Reply",
  send: "Send",
  /** How many messages on a row the viewer has not read (conversation.md §1). */
  unreadCount: (count: number) => `${count} new`,
  callsTo: (target: string) => `Calls to ${target}`,
  lastCall: (when: string, answer: string) => `last ${when}, ${answer}.`,
  answered: (status: string) => `answered ${status}`,
  callNotMade: "not made after a day of tries",
  noCallsYet: "No calls yet.",
  sentTo: "Sent to",
  sendAgain: "Send again",
  sendInvitation: "Send invitation",
  sendMeACode: "Send me a code",
  sending: "Sending…",
  shortcuts: "Shortcuts",
  showOnMap: "Show on map",
  signIn: "Sign in",
  signInCodes: "sign-in codes",
  signInFirst: "Please sign in first.",
  signInToBook: "Sign in to book",
  signOut: "Sign out",
  site: "Site",
  somethingWentWrong: "Something went wrong.",
  sortBy: "Sort by",
  status: "Status",
  submissions: "submissions",
  testimonials: "Testimonials",
  thankYou: "Thank you! We will get back to you soon.",
  theApp: "the app",
  thisUser: "this user",
  to: "To",
  today: "Today",
  /** A date filter's relative values (Upcoming, Past, Today, This week, This month). */
  upcoming: "Upcoming",
  past: "Past",
  thisWeek: "This week",
  thisMonth: "This month",
  /** The filters folded away when a list is first reached, and folding them again. */
  moreFilters: "More filters",
  fewerFilters: "Fewer filters",
  trashEmpty: "Nothing is in the trash.",
  trashLead: "Deleted records stay here for thirty days, then they are removed for good.",
  trashOf: (plural: string) => `${plural} in the trash`,
  trashView: "Trash",
  tryAgain: "Something went wrong. Please try again.",
  tryItAs: "Try it as",
  undoIt: "Undo",
  useAnotherAddress: "Use another address",
  usingAKey: "Using a key",
  visitor: "visitor",
  was: "was",
  week: "Week",
  what: "What",
  whatItIsFor: "What it is for",
  withdraw: "Withdraw",
  write: "Write",
  yes: "Yes",
  yesCancelIt: "Yes, cancel it",
  /** The activity log: a record that is gone, by its id. */
  aDeletedOne: (label: string, id: string) => `a deleted ${label.toLowerCase()} (#${id})`,
  aKey: (id: string) => `a key (#${id})`,
  /** Who did it, in Activity: a timer of the app (timed-actions.md). */
  byTimer: (name: string) => `the timer ${name}`,
  aRemovedUser: (id: string) => `a removed user (#${id})`,
  atLeastCharacters: (n: number) => `At least ${n} characters`,
  atMostCharacters: (n: number) => `At most ${n.toLocaleString("en")} characters`,
  /** The sign-in mail. */
  codeSubject: (app: string) => `Your code for ${app}`,
  codeText: (app: string, code: string) =>
    `Your code for ${app} is ${code}. It works for ten minutes. If you did not ask for it, ignore this mail.`,
  /** The form's button for a new record: "Create customer". */
  createOne: (label: string) => `Create ${label}`,
  deletedNamed: (label: string, title: string) => `${label} "${title}" (deleted)`,
  /** The invitation mail. */
  invitationSubject: (app: string) => `Invitation to ${app}`,
  invitationText: (
    by: string,
    app: string,
    role: string,
    email: string,
    link: string,
    until: string,
  ) =>
    `${by} invited you to ${app} as ${role}.\n\nSign in with ${email} here:\n${link}\n\nThe invitation is valid until ${until}.`,
  keyNamed: (name: string) => `key "${name}"`,
  moveEarlier: (name: string) => `Move ${name} earlier`,
  moveLater: (name: string) => `Move ${name} later`,
  /** "New customer": the page and the button. */
  newOne: (label: string) => `New ${label}`,
  openApp: (app: string) => `Open ${app}`,
  /** The site frame's link into the app's pages, for one who may open them. */
  workspace: "Workspace",
  removeIt: (name: string) => `Remove ${name}`,
  welcomeTo: (app: string) => `Welcome to ${app}`,
  you: "(you)",
  youAreBooked: "You're booked",
  yourEmail: "Your email",
  yourName: "Your name",
  yourNameHelp: "The name others see in this app.",
  /** A unique field's value taken. */
  alreadyHas: (label: string, field: string) =>
    `Another ${label.toLowerCase()} already has this ${field.toLowerCase()}.`,
  /** A capacity below the places already booked. */
  alreadyTaken: (booked: string) =>
    `${booked} ${booked === "1" ? "is" : "are"} already taken; the number cannot go below that.`,
  atMostPictures: (max: number) => `At most ${max} pictures; the rest were left out.`,
  /** The selection bar: "3 orders deleted, 1 skipped." */
  counted: (done: number, one: string, many: string, verb: string, skipped: number) =>
    `${done} ${done === 1 ? one : many} ${verb}${skipped ? `, ${skipped} skipped` : ""}.`,
  found: (total: number, first: string[]) =>
    `${total} found${first.length ? `: ${first.join(", ")}` : ""}.`,
  /** A range filter with no end. */
  fromValue: (from: string) => `from ${from}`,
  askedFind: (plural: string, conditions: string[], sort: string, shown: number, total?: number) =>
    `${plural}${conditions.length ? ` where ${conditions.join(", ")}` : ""}${sort ? `, ${sort}` : ""} · ${total === undefined || total === shown ? shown : `${shown} of ${total}`}`,
  askedMeasure: (
    how: string,
    field: string | undefined,
    plural: string,
    conditions: string[],
    by?: string,
  ) =>
    `${{ count: "Count of", sum: "Sum of", average: "Average", min: "Smallest", max: "Largest" }[how] ?? how}${field ? ` ${field} over` : ""} ${plural.toLowerCase()}${conditions.length ? ` where ${conditions.join(", ")}` : ""}${by ? `, per ${by}` : ""}`,
  askedRead: (label: string, id: string) => `${label} ${id}`,
  fieldIs: (label: string, value: string) => `${label} is ${value}`,
  fromTo: (from?: string, to?: string) =>
    from && to ? `from ${from} to ${to}` : from ? `from ${from}` : `to ${to}`,
  orList: (values: string[]) => values.join(" or "),
  over: (n: string) => `over ${n}`,
  sortedBy: (label: string, largestFirst: boolean) =>
    largestFirst ? `largest ${label} first` : `by ${label}`,
  under: (n: string) => `under ${n}`,
  withWords: (search: string) => `with "${search}"`,
  yoursOnly: "yours",
  inAll: (total: number) => `${total} in all`,
  invitationKept: (address: string) =>
    `Invitation to ${address} written to the preview's outbox, not sent: the preview sends no mail. Studio's Outbox shows it.`,
  invitationSentAgain: (address: string) => `Invitation sent again to ${address}.`,
  invitationSentTo: (address: string) => `Invitation sent to ${address}.`,
  /** Followed by the address in bold. */
  invitedAs: (app: string, role: string) => `You were invited to ${app} as ${role}. Sign in with`,
  invitedUntil: (date: string) => `Invited, valid until ${date}`,
  modelAnswered: (status: number) => `The model answered ${status}.`,
  modelTimedOut: (seconds: number) => `The model did not answer within ${seconds} seconds.`,
  movePictureEarlier: (n: number) => `Move picture ${n} earlier`,
  movePictureLater: (n: number) => `Move picture ${n} later`,
  /** The calendar's empty slot: "New session, Monday 6 October at 09:00". */
  newAt: (what: string, day: string, time: string) => `${what}, ${day} at ${time}`,
  noMailYet: (app: string) =>
    `Signing in by email is not available yet: ${app} cannot send mail. Please contact whoever runs it.`,
  /** An empty list: "No customers yet". */
  noneYet: (plural: string) => `No ${plural} yet`,
  nothingMatchesText: (text: string) => `Nothing matches “${text}”.`,
  openPicture: (alt: string) => `Open ${alt}`,
  placesLeft: (left: number, max: number) =>
    `${left} of ${max} ${max === 1 ? "place" : "places"} left`,
  /** Under a table that is one page of a longer list: "1–50 of 1,234". */
  range: (from: string, to: string, total: string) => `${from}–${to} of ${total}`,
  removeFilter: (label: string) => `Remove the ${label.toLowerCase()} filter`,
  // A field's rules on the record (record-rules.md): a lock, a requirement while a condition holds.
  cannotChangeNow: (label: string) => `${label} cannot be changed now.`,
  requiredNow: (label: string) => `${label} is required now.`,
  removePicture: (n: number) => `Remove picture ${n}`,
  removeWho: (name: string) => `Remove ${name}?`,
  revokeKey: (name: string) => `Revoke "${name}"? Programs using it stop working at once.`,
  roleOf: (name: string) => `Role of ${name}`,
  saveIt: (label: string) => `Save ${label}`,
  selectIt: (label: string) => `Select ${label}`,
  signInAs: (role: string) => `Sign in as ${role}`,
  signInTo: (app: string) => `Sign in to ${app}`,
  stillInUse: (title: string) => `"${title}" is still in use, so nothing was deleted.`,
  stillUsed: (label: string) =>
    `This ${label.toLowerCase()} is still used by other records. Change or delete those first.`,
  stoppedAfter: (rounds: number) => `Stopped after ${rounds} model calls.`,
  /** "Delete this customer?" */
  thisOne: (label: string) => `this ${label.toLowerCase()}`,
  /** The rate limit; `what` is "changes" or "invitations". */
  tooMany: (what: string) => `Too many ${what} in a short time. Wait a minute and try again.`,
  toolsAt: (origin: string) =>
    `For an AI assistant: the tools are at ${origin}/mcp. Its settings need:`,
  /** A range filter with no start. */
  upToValue: (to: string) => `up to ${to}`,
  wentWrongReference: (reference: string | undefined) =>
    `Something went wrong. Please try again.${reference ? ` Reference: ${reference}` : ""}`,
  /** The inspector: a step the assistant proposed. */
  wouldDo: (tool: string, what: string) => `It would ${tool} ${what}; nothing was changed.`,
  calculated: "(calculated)",
  changedVerb: "changed",
  clear: "Clear",
  createFirst: "Create the first one to get started.",
  deletedVerb: "deleted",
  endsOptional: "Ends (optional)",
  filters: "Filters",
  mainMenu: "Main",
  markdownHint: "Markdown: **bold**, *italic*, ## a heading, - a list, [a link](https://…)",
  noModel: ", no model",
  options: "Options",
  pictureDescription: "Description (for those who cannot see it)",
  question: "Question",
  trashedVerb: "moved to the trash",
  asRole: (role: string) => `as ${role}`,
  contactThe: (who: string) => `Contact the ${who}`,
  continueWith: (provider: string) => `Continue with ${provider}`,
  deleteHowMany: (n: number, noun: string) => `Delete ${n} ${noun}? This cannot be undone.`,
  deleteIt: (label: string) => `Delete ${label}`,
  deleteN: (n: number) => `Delete (${n})`,
  endsOn: (day: string) => `ends ${day}`,
  lastUsed: (day: string) => `last used ${day}`,
  pictureDescriptionN: (n: number) => `Description of picture ${n}`,
  /** A range filter's two boxes, for screen readers: "Price from". */
  rangeFrom: (label: string) => `${label} from`,
  rangeTo: (label: string) => `${label} to`,
  revokedOn: (day: string) => `Revoked ${day}`,
  selectedN: (n: number) => `${n} selected`,
  signInUnavailable: (app: string) =>
    `Signing in is not available right now. Please contact whoever runs ${app}.`,
  stepOf: (n: number, count: number) => `Step ${n} of ${count}`,
  tokensInOut: (tokensIn: number, tokensOut: number) => `, ${tokensIn} tokens in, ${tokensOut} out`,
  toolCalls: (n: number) => `${n} tool ${n === 1 ? "call" : "calls"}`,
  trashHowMany: (n: number, noun: string) =>
    `Move ${n} ${noun} to the trash? ${n === 1 ? "It" : "They"} can be restored from there for 30 days.`,
  trashN: (n: number) => `Move to trash (${n})`,
  /** The privacy page (kit LegalPage), written from the app's own definition. */
  legalIntro: (app: string) =>
    `This page says what ${app} stores about you and why. It is written from the app's own definition and changes with it.`,
  legalOperatorTitle: "Who runs it",
  legalOperator: (name: string, app: string) => `${app} is run by ${name}.`,
  legalOperatorUnknown: "The operator's name and contact details are not filled in yet.",
  legalPurpose: (app: string, purpose: string) => `${app}: ${purpose}`,
  legalAccountTitle: "Your account",
  legalByEmailCode: "a code sent to your email address",
  legalByGoogle: "your Google account",
  legalAccount: (providers: string[]) =>
    `When you sign in, the app keeps your name, your email address and your role, and sets a cookie that keeps you signed in.${providers.length ? ` You sign in with ${providers.join(" or ")}.` : ""}`,
  legalInvitedOnly: "Only people who are invited can sign in.",
  legalRecordsTitle: "Information in records",
  legalRecordsIntro:
    "Besides accounts, the app keeps these kinds of records with personal details:",
  legalReadBy: (readers: "visitors" | "members" | string[]) =>
    readers === "visitors"
      ? "Anyone on the internet can read them."
      : readers === "members"
        ? "People who sign in can read them."
        : `Read by: ${readers.join(", ")}.`,
  legalNoRecords: "Besides accounts, no record in the app holds personal details.",
  legalUploads:
    "Pictures and documents people upload are stored with their records and shown to those who may read the record.",
  legalCookiesTitle: "Cookies",
  legalCookies:
    "The app sets one cookie, which keeps you signed in. It is needed for the app to work. There is no tracking cookie.",
  legalNoCookies: "The app sets no cookie of its own.",
  legalAnalytics: (provider: string) =>
    `Visits are counted with ${provider}, which sets no cookie and keeps no personal data.`,
  legalAnalyticsConsent: (provider: string) =>
    `Visits are counted with ${provider} only after you accept it in the cookie bar. You can change your choice under Cookie settings at the bottom of the page.`,
  legalMailTitle: "Mail",
  legalMailSignIn: "The app sends mail for signing in and for invitations.",
  legalMailEvents: (labels: string[]) =>
    `It also sends mail when something happens to ${labels.join(", ")}, to the person concerned or to the people who work in the app.`,
  legalLogsTitle: "Logs and backups",
  legalLogs:
    "Requests are logged with your address and browser for 90 days. Changes to records are kept in an activity log for 12 months; names and addresses in it are removed after 90 days.",
  legalBackups: "Backups are kept so the app can be restored after a mistake.",
  legalBackupsAt: (hosting: string) =>
    `The app and its backups are hosted ${hosting}. Backups are kept so the app can be restored after a mistake.`,
  legalRightsTitle: "Your rights",
  legalRights: (email?: string) =>
    `You may ask what the app holds about you, have it corrected or removed, and object to its use.${email ? ` Write to ${email}.` : " Contact whoever runs the app."} You may also complain to the data protection authority in your country.`,
  legalMoreTitle: "More",
  /** The inspector: a change the role may only propose. */
  wouldPropose: (tool: string, what: string) =>
    `Would ${tool} ${what}: an assistant with this role may propose it, and nothing was changed.`,
  /** The order page (orders.md §1). */
  orderRemove: (label: string) => `Remove one ${label}`,
  soldOut: "Sold out",
  orderBar: (count: number, total: string) =>
    `${count} ${count === 1 ? "item" : "items"} · ${total}`,
  orderSend: "Order",
  orderDetails: "Your details",
  orderPlace: "Send the order",
  orderPlaced: (number: string) => `Order ${number} is in.`,
  orderClosed: (opens?: string) => (opens ? `Closed, opens ${opens}` : "Closed"),
  orderSoldOut: (label: string) => `Sold out: ${label}`,
  orderEmpty: "Nothing chosen yet.",
  /** A chart's bar for a quarter: "Q3 2026". */
  quarterOf: (quarter: number, year: string) => `Q${quarter} ${year}`,
  /** A list's totals row (intents.md §5): "Total of 12". */
  totalsRow: (count: number) => `Total of ${count}`,
  orderTotal: "Total",
  /** Merging two records (docs/design/intents.md §3). */
  mergeInto: "Merge into…",
  mergeIntoWhich: (label: string) => `Which ${label.toLowerCase()} does this one merge into?`,
  mergeChoose: "Choose one",
  mergeKeeps: "Keep",
  mergeDecide: "They differ here: choose what stays",
  mergeSum: "Added up",
  mergeJoin: "All of them, one after the other",
  mergeSame: "Choose two different records to merge.",
  mergeTooMany: (most: number) => `Choose at most ${most} records to merge at once.`,
  mergeBothHave: (label: string) =>
    `More than one of them has its own ${label.toLowerCase()}, and there can be only one: keep one first.`,
  mergeMayNotChange: (plural: string) =>
    `Some ${plural.toLowerCase()} that refer to it are not yours to change, so nothing was merged.`,
  /** "Arctic Outdoor Co keeps its values; 3 orders move to it, and Arctic Outdoor goes to the trash." */
  mergeSentence: (
    kept: string,
    moves: string[],
    others: string[],
    goes: "trash" | "gone" | "stays" | "some",
    taken: string[],
  ) => {
    const list = (items: string[]) =>
      items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
    const other = list(others);
    const one = others.length === 1;
    const values = taken.length
      ? `${kept} keeps its values and takes ${list(taken.map((t) => t.toLowerCase()))} from ${other}`
      : `${kept} keeps its values`;
    const moved = moves.length ? `; ${list(moves)} move to it` : "";
    const fate =
      goes === "trash"
        ? `${other} ${one ? "goes" : "go"} to the trash`
        : goes === "gone"
          ? `${other} ${one ? "is" : "are"} deleted for good`
          : goes === "some"
            ? `those of ${other} you may delete go to the trash, the rest stay`
            : `${other} ${one ? "stays, since you may not delete it" : "stay, since you may not delete them"}`;
    return `${values}${moved}, and ${fate}.`;
  },
  /** A combine's form: "A new customer is made from A, B and C, which stay as they are." */
  combineSentence: (from: string[], label: string, emptied: string[], removed: boolean) => {
    const list = (items: string[]) =>
      items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
    const made = `A new ${label.toLowerCase()} is made from ${list(from)}, which ${removed ? "go to the trash" : "stay as they are"}.`;
    return emptied.length
      ? `${made} Its ${list(emptied.map((e) => e.toLowerCase()))} ${emptied.length === 1 ? "is" : "are"} left empty, since that stays with theirs.`
      : made;
  },
  combineRemove:
    "Put them in the trash: they are the same apart from what is added up, and nothing refers to them",
  combineNotRemovable:
    "They can go to the trash only when they are the same apart from what is added up, nothing refers to them, and you may delete them.",
  /** "Combined A, B and C into a new customer; they stay as they were." */
  combined: (from: string[], label: string, removed: boolean) => {
    const list = (items: string[]) =>
      items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
    return `Combined ${list(from)} into a new ${label.toLowerCase()}; they ${removed ? "went to the trash" : "stay as they were"}.`;
  },
  /** Splitting a record (docs/design/intents.md §4). */
  splitIt: "Split…",
  splitWhich: (plural: string) => `Which ${plural.toLowerCase()} go to the new record?`,
  splitPickOne: (label: string) => `Pick at least one ${label.toLowerCase()} to move.`,
  splitLeaveOne: (label: string) => `Leave at least one ${label.toLowerCase()} where it is.`,
  splitMayNotChange: (plural: string) =>
    `Some of the ${plural.toLowerCase()} picked are not yours to change, so nothing was split.`,
  splitOriginalGone: "The record this was split from is gone, so there is nothing to undo into.",
  splitNotSplit: "This record was not made by a split.",
  splitDone: (from: string) => `Split off from ${from}.`,
  splitStayed: (n: number) =>
    `${n} ${n === 1 ? "record was" : "records were"} moved elsewhere since and stay there.`,
  mergedIntoTitle: (title: string) => `merged into “${title}”`,
  mergeKeepIs: (which: "oldest" | "newest", title: string) =>
    `With this merge the ${which} of the two stays: ${title}.`,
  mergeChoiceMissing: (field: string) => `${field} differs among them: say whose stays.`,
  mergeDone: (other: string, kept: string) => `${other} was merged into ${kept}.`,
  mergeStayed: (n: number) =>
    `${n} ${n === 1 ? "thing was" : "things were"} changed since the merge, or ${n === 1 ? "is" : "are"} not yours to change, and stay as ${n === 1 ? "it is" : "they are"}.`,
};

export type Words = typeof w;
