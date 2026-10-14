// The questions of bench-ask (docs/design/assistant.md §9): what people ask an app's assistant,
// per starter, against its sample records. Each answer is worked out from the records at run time
// (`d` is every model's records as the API returns them: fields by their spec names, references as
// ids, money as decimal text), so it stays right when the samples change.
//   number  the answer must contain this number (formatting aside)
//   names   it must name each of these (an empty list: it must say there are none)
//   text    it must contain each of these words
//   pairs   it must give each key with its number
//   change  the records afterwards must pass `check(after, before)`; the answer is not read
//
// Expected values worked out here, from `d`, never typed in by hand.

const n = (v) => Number(v ?? 0);
const sum = (rows, f) => Math.round(rows.reduce((s, r) => s + n(f(r)), 0) * 100) / 100;
const named = (rows, field, value) => rows.find((r) => r[field] === value);
const count = (rows, field) =>
  Object.fromEntries(
    [...new Set(rows.map((r) => r[field]))].map((v) => [
      v,
      rows.filter((r) => r[field] === v).length,
    ]),
  );
const id = (rows, field, value) => named(rows, field, value)?.id;

/** An invoice's total from its lines (the formula, worked out again from the lines). */
const invoiceTotal = (d, inv) =>
  sum(
    d.InvoiceLine.filter((l) => l.invoice === inv.id),
    (l) => n(l.quantity) * n(l.unitPrice),
  );

export const QUESTIONS = {
  crm: [
    { q: "How many customers do we have?", kind: "number", expect: (d) => d.Customer.length },
    {
      q: "How many customers are enterprise?",
      kind: "number",
      expect: (d) => d.Customer.filter((c) => c.segment === "enterprise").length,
    },
    {
      q: "How many orders are still drafts?",
      kind: "number",
      expect: (d) => d.Order.filter((o) => o.status === "draft").length,
    },
    { q: "Orders per status?", kind: "pairs", expect: (d) => count(d.Order, "status") },
    {
      q: "What is the total of all placed orders?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Order.filter((o) => o.status === "placed"),
          (o) => o.total,
        ),
    },
    {
      q: "What is our largest order, and who placed it?",
      kind: "names",
      expect: (d) => {
        const o = [...d.Order].sort((a, b) => n(b.total) - n(a.total))[0];
        return [o.number, d.Customer.find((c) => c.id === o.customer).name];
      },
    },
    {
      q: "Which customers are in the government segment?",
      kind: "names",
      expect: (d) => d.Customer.filter((c) => c.segment === "government").map((c) => c.name),
    },
    {
      q: "Show me Kallio Design's orders.",
      kind: "names",
      expect: (d) =>
        d.Order.filter((o) => o.customer === id(d.Customer, "name", "Kallio Design")).map(
          (o) => o.number,
        ),
    },
    {
      q: "What is Nordic Timber's credit limit?",
      kind: "number",
      expect: (d) => n(named(d.Customer, "name", "Nordic Timber Oy").creditLimit),
    },
    {
      q: "What's Baltic Freight's phone number?",
      kind: "text",
      expect: (d) => [named(d.Customer, "name", "Baltic Freight AB").phone],
    },
    {
      q: "Which orders go by express shipping?",
      kind: "names",
      expect: (d) => d.Order.filter((o) => o.shippingMethod === "express").map((o) => o.number),
    },
    {
      q: "How much has Skerry Software ordered in total?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Order.filter((o) => o.customer === id(d.Customer, "name", "Skerry Software")),
          (o) => o.total,
        ),
    },
    {
      q: "What is the average order total?",
      kind: "number",
      expect: (d) => Math.round((sum(d.Order, (o) => o.total) / d.Order.length) * 100) / 100,
    },
    {
      q: "Which customers have never ordered anything?",
      kind: "names",
      expect: (d) =>
        d.Customer.filter((c) => !d.Order.some((o) => o.customer === c.id)).map((c) => c.name),
    },
    {
      q: "How many orders were placed in September 2026?",
      kind: "number",
      expect: (d) => d.Order.filter((o) => String(o.placedAt).startsWith("2026-09")).length,
    },
    {
      q: "Which orders are over 5 000 €?",
      kind: "names",
      expect: (d) => d.Order.filter((o) => n(o.total) > 5000).map((o) => o.number),
    },
    {
      q: "What does shipping cost on order ORD-1007?",
      kind: "number",
      expect: (d) => n(named(d.Order, "number", "ORD-1007").shippingCost),
    },
    {
      q: "Who has the highest credit limit?",
      kind: "names",
      expect: (d) => [[...d.Customer].sort((a, b) => n(b.creditLimit) - n(a.creditLimit))[0].name],
    },
    {
      q: "What's the total credit limit of our SMB customers?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Customer.filter((c) => c.segment === "smb"),
          (c) => c.creditLimit,
        ),
    },
    {
      q: "Mark order ORD-1005 as shipped.",
      kind: "change",
      check: (a) => named(a.Order, "number", "ORD-1005")?.status === "shipped",
    },
    {
      q: "Kallio Design is an enterprise customer now, please change that.",
      kind: "change",
      check: (a) => named(a.Customer, "name", "Kallio Design")?.segment === "enterprise",
    },
    {
      q: 'Add a note to Helios Energy: "Called on Monday about the next park."',
      kind: "change",
      check: (a) => /next park/.test(named(a.Customer, "name", "Helios Energy")?.notes ?? ""),
    },
    {
      q: "Cancel order ORD-1008.",
      kind: "change",
      check: (a) => named(a.Order, "number", "ORD-1008")?.status === "canceled",
    },
    {
      q: "Add a customer: Lumo Studio, hello@lumo.example, small business.",
      kind: "change",
      check: (a) => {
        const c = named(a.Customer, "name", "Lumo Studio");
        return c?.email === "hello@lumo.example" && c.segment === "smb";
      },
    },
    {
      q: "Delete the draft order ORD-1006.",
      kind: "change",
      check: (a, b) =>
        named(b.Order, "number", "ORD-1006") && !named(a.Order, "number", "ORD-1006"),
    },
  ],

  invoicing: [
    { q: "How many invoices are there?", kind: "number", expect: (d) => d.Invoice.length },
    {
      q: "Which invoices are overdue?",
      kind: "names",
      expect: (d) => d.Invoice.filter((i) => i.status === "overdue").map((i) => i.number),
    },
    {
      q: "Show the unpaid invoices: the sent and the overdue ones.",
      kind: "names",
      expect: (d) =>
        d.Invoice.filter((i) => ["sent", "overdue"].includes(i.status)).map((i) => i.number),
    },
    {
      q: "How much does Solstice Bakery owe us?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Invoice.filter(
            (i) =>
              i.client === id(d.Client, "name", "Solstice Bakery") &&
              ["sent", "overdue"].includes(i.status),
          ),
          (i) => invoiceTotal(d, i),
        ),
    },
    {
      q: "What is the total of invoice 2026-001?",
      kind: "number",
      expect: (d) => invoiceTotal(d, named(d.Invoice, "number", "2026-001")),
    },
    {
      q: "How much have we been paid in total?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Invoice.filter((i) => i.status === "paid"),
          (i) => invoiceTotal(d, i),
        ),
    },
    {
      q: "How many invoices per status?",
      kind: "pairs",
      expect: (d) => count(d.Invoice, "status"),
    },
    {
      q: "Which client has the most invoices?",
      kind: "names",
      expect: (d) => {
        const c = d.Client.map((x) => [x.name, d.Invoice.filter((i) => i.client === x.id).length]);
        const top = Math.max(...c.map(([, k]) => k));
        return c.filter(([, k]) => k === top).map(([x]) => x);
      },
    },
    {
      q: "What's Kallio Design's VAT number?",
      kind: "text",
      expect: (d) => [named(d.Client, "name", "Kallio Design").vatNumber],
    },
    {
      q: "Which of our clients are in Finland?",
      kind: "names",
      expect: (d) => d.Client.filter((c) => /Finland/.test(c.address ?? "")).map((c) => c.name),
    },
    {
      q: "When is invoice 2026-004 due?",
      kind: "text",
      expect: (d) => [named(d.Invoice, "number", "2026-004").dueOn],
    },
    {
      q: "What is the biggest single line we have invoiced?",
      kind: "text",
      expect: (d) => [
        [...d.InvoiceLine]
          .sort((a, b) => n(b.quantity) * n(b.unitPrice) - n(a.quantity) * n(a.unitPrice))[0]
          .description.split(",")[0],
      ],
    },
    {
      q: "How much did we invoice in August 2026?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Invoice.filter((i) => String(i.issuedOn).startsWith("2026-08")),
          (i) => invoiceTotal(d, i),
        ),
    },
    {
      q: "How many hours have we billed at 85 an hour?",
      kind: "number",
      expect: (d) =>
        sum(
          d.InvoiceLine.filter((l) => n(l.unitPrice) === 85),
          (l) => l.quantity,
        ),
    },
    {
      q: "What is on invoice 2026-005?",
      kind: "names",
      expect: (d) =>
        d.InvoiceLine.filter((l) => l.invoice === id(d.Invoice, "number", "2026-005")).map(
          (l) => l.description,
        ),
    },
    {
      q: "What do the draft invoices add up to?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Invoice.filter((i) => i.status === "draft"),
          (i) => invoiceTotal(d, i),
        ),
    },
    {
      q: "Which invoices did Skerry Software get?",
      kind: "names",
      expect: (d) =>
        d.Invoice.filter((i) => i.client === id(d.Client, "name", "Skerry Software")).map(
          (i) => i.number,
        ),
    },
    {
      q: "What is the average invoice?",
      kind: "number",
      expect: (d) =>
        Math.round((sum(d.Invoice, (i) => invoiceTotal(d, i)) / d.Invoice.length) * 100) / 100,
    },
    {
      q: "How much is still to be paid to us?",
      kind: "number",
      // Read two ways: what is sent and overdue, or that and the drafts, when the answer says so.
      also: {
        when: /draft/i,
        expect: (d) =>
          sum(
            d.Invoice.filter((i) => i.status !== "paid"),
            (i) => invoiceTotal(d, i),
          ),
      },
      expect: (d) =>
        sum(
          d.Invoice.filter((i) => ["sent", "overdue"].includes(i.status)),
          (i) => invoiceTotal(d, i),
        ),
    },
    {
      q: "Which client have we invoiced the most?",
      kind: "names",
      expect: (d) => [
        d.Client.map((c) => [
          c.name,
          sum(
            d.Invoice.filter((i) => i.client === c.id),
            (i) => invoiceTotal(d, i),
          ),
        ]).sort((a, b) => b[1] - a[1])[0][0],
      ],
    },
    {
      q: "Invoice 2026-004 has been paid.",
      kind: "change",
      check: (a) => named(a.Invoice, "number", "2026-004")?.status === "paid",
    },
    {
      q: "Mark invoice 2026-006 as sent.",
      kind: "change",
      check: (a) => named(a.Invoice, "number", "2026-006")?.status === "sent",
    },
    {
      q: "Send Fjord Analytics' invoices to billing@fjordanalytics.example from now on.",
      kind: "change",
      check: (a) =>
        named(a.Client, "name", "Fjord Analytics")?.email === "billing@fjordanalytics.example",
    },
    {
      q: "Add a line to invoice 2026-006: proofreading, two hours at 60.",
      kind: "change",
      check: (a) =>
        a.InvoiceLine.some(
          (l) =>
            l.invoice === id(a.Invoice, "number", "2026-006") &&
            /proofread/i.test(l.description) &&
            n(l.quantity) === 2 &&
            n(l.unitPrice) === 60,
        ),
    },
    {
      q: "Add a client: Norrsken AB, info@norrsken.example.",
      kind: "change",
      check: (a) => named(a.Client, "name", "Norrsken AB")?.email === "info@norrsken.example",
    },
  ],

  status: [
    {
      q: "Is anything down right now?",
      kind: "names",
      expect: (d) => d.Component.filter((c) => c.status !== "operational").map((c) => c.name),
    },
    {
      q: "What's the status of the website?",
      kind: "text",
      expect: (d) => [named(d.Component, "name", "Website").status],
    },
    {
      q: "How many incidents are still open?",
      kind: "number",
      expect: (d) => d.Incident.filter((i) => i.status !== "resolved").length,
    },
    {
      q: "Which incident are we monitoring?",
      kind: "names",
      expect: (d) => d.Incident.filter((i) => i.status === "monitoring").map((i) => i.title),
    },
    {
      q: "How long was the website down, in minutes?",
      kind: "number",
      expect: (d) => {
        const i = d.Incident.find((x) => x.component === id(d.Component, "name", "Website"));
        return Math.round((Date.parse(i.resolvedAt) - Date.parse(i.detectedAt)) / 60000);
      },
    },
    {
      q: "How many updates did we post about the card payments incident?",
      kind: "number",
      expect: (d) =>
        d.IncidentUpdate.filter(
          (u) => u.incident === id(d.Incident, "title", "Card payments slow at checkout"),
        ).length,
    },
    {
      q: "What was our last update on the card payments problem?",
      kind: "text",
      expect: (d) => [
        d.IncidentUpdate.filter(
          (u) => u.incident === id(d.Incident, "title", "Card payments slow at checkout"),
        )
          .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
          .message.split(".")[0],
      ],
    },
    {
      q: "What maintenance is planned?",
      kind: "names",
      expect: (d) => d.Maintenance.map((m) => m.title),
    },
    {
      q: "Which component is the database upgrade for?",
      kind: "names",
      expect: (d) => [
        d.Component.find(
          (c) => c.id === named(d.Maintenance, "title", "Database upgrade").component,
        ).name,
      ],
    },
    {
      q: "How many components do we report on?",
      kind: "number",
      expect: (d) => d.Component.length,
    },
    {
      q: "Which incidents affected Payments?",
      kind: "names",
      expect: (d) =>
        d.Incident.filter((i) => i.component === id(d.Component, "name", "Payments")).map(
          (i) => i.title,
        ),
    },
    {
      q: "How many incidents were there in September 2026?",
      kind: "number",
      expect: (d) => d.Incident.filter((i) => String(i.detectedAt).startsWith("2026-09")).length,
    },
    {
      q: "List the components and their status.",
      kind: "names",
      expect: (d) => d.Component.flatMap((c) => [c.name, c.status]),
    },
    {
      q: "Which incident was caused by a certificate?",
      kind: "names",
      expect: (d) =>
        d.Incident.filter((i) => /certificate/i.test(i.summary ?? "")).map((i) => i.title),
    },
    {
      q: "How many updates have we posted in all?",
      kind: "number",
      expect: (d) => d.IncidentUpdate.length,
    },
    {
      q: "How many incidents per status?",
      kind: "pairs",
      expect: (d) => count(d.Incident, "status"),
    },
    {
      q: "Which components are operational?",
      kind: "names",
      expect: (d) => d.Component.filter((c) => c.status === "operational").map((c) => c.name),
    },
    {
      q: "Is any incident open on the mobile app?",
      kind: "names",
      expect: (d) =>
        d.Incident.filter(
          (i) => i.status !== "resolved" && i.component === id(d.Component, "name", "Mobile app"),
        ).map((i) => i.title),
    },
    {
      q: "The card payments incident is over, resolve it.",
      kind: "change",
      check: (a) =>
        named(a.Incident, "title", "Card payments slow at checkout")?.status === "resolved",
    },
    {
      q: "Payments work normally again: set the component to operational.",
      kind: "change",
      check: (a) => named(a.Component, "name", "Payments")?.status === "operational",
    },
    {
      q: 'Post an update on the card payments incident: "Fully recovered, no payments were lost.", status resolved.',
      kind: "change",
      check: (a, b) =>
        // At least this update (resolving the incident adds one of its own as well).
        a.IncidentUpdate.length > b.IncidentUpdate.length &&
        a.IncidentUpdate.some((u) => /Fully recovered/.test(u.message ?? "")),
    },
    {
      q: "Report a new incident: logging in to the mobile app fails, we're investigating.",
      kind: "change",
      check: (a, b) =>
        a.Incident.length === b.Incident.length + 1 &&
        a.Incident.some(
          (i) =>
            i.status === "investigating" && i.component === id(a.Component, "name", "Mobile app"),
        ),
    },
    {
      q: "Move the database upgrade one week later, same times.",
      kind: "change",
      check: (a, b) => {
        const x = named(a.Maintenance, "title", "Database upgrade");
        const y = named(b.Maintenance, "title", "Database upgrade");
        return (
          Date.parse(x.startsAt) - Date.parse(y.startsAt) === 7 * 86400000 &&
          Date.parse(x.endsAt) - Date.parse(y.endsAt) === 7 * 86400000
        );
      },
    },
    {
      q: "Change the website's description to: The public website, the shop and the blog.",
      kind: "change",
      check: (a) =>
        named(a.Component, "name", "Website")?.description ===
        "The public website, the shop and the blog.",
    },
    {
      q: "Add a component: Search, operational.",
      kind: "change",
      check: (a) => named(a.Component, "name", "Search")?.status === "operational",
    },
  ],

  booking: [
    {
      q: "How many kinds of class do we offer?",
      kind: "number",
      expect: (d) => d.ClassType.length,
    },
    {
      q: "Which classes are for beginners?",
      kind: "names",
      expect: (d) => d.ClassType.filter((c) => c.level === "beginner").map((c) => c.name),
    },
    {
      q: "Which classes last 75 minutes?",
      kind: "names",
      expect: (d) => d.ClassType.filter((c) => n(c.durationMinutes) === 75).map((c) => c.name),
    },
    {
      q: "Who teaches Yin?",
      kind: "names",
      expect: (d) => [
        ...new Set(
          d.Session.filter((s) => s.classType === id(d.ClassType, "name", "Yin")).map(
            (s) => d.Instructor.find((i) => i.id === s.instructor).name,
          ),
        ),
      ],
    },
    {
      q: "How many sessions does Oskar Berg teach?",
      kind: "number",
      expect: (d) =>
        d.Session.filter((s) => s.instructor === id(d.Instructor, "name", "Oskar Berg")).length,
    },
    {
      q: "How many places are there in all the sessions together?",
      kind: "number",
      expect: (d) => sum(d.Session, (s) => s.capacity),
    },
    {
      q: "Who teaches the most sessions?",
      kind: "names",
      expect: (d) => {
        const c = d.Instructor.map((i) => [
          i.name,
          d.Session.filter((s) => s.instructor === i.id).length,
        ]);
        const top = Math.max(...c.map(([, k]) => k));
        return c.filter(([, k]) => k === top).map(([x]) => x);
      },
    },
    {
      q: "How many posts are published?",
      kind: "number",
      expect: (d) => d.Post.filter((p) => p.status === "published").length,
    },
    {
      q: "What is our newest post?",
      kind: "names",
      expect: (d) => [
        [...d.Post].sort((a, b) => String(b.publishedOn).localeCompare(String(a.publishedOn)))[0]
          .title,
      ],
    },
    {
      q: 'When was "What to bring to your first class" published?',
      kind: "text",
      expect: (d) => [named(d.Post, "title", "What to bring to your first class").publishedOn],
    },
    {
      q: "Which classes does Aino Virtanen teach?",
      kind: "names",
      expect: (d) => [
        ...new Set(
          d.Session.filter((s) => s.instructor === id(d.Instructor, "name", "Aino Virtanen")).map(
            (s) => d.ClassType.find((c) => c.id === s.classType).name,
          ),
        ),
      ],
    },
    {
      q: "How long is a Vinyasa class?",
      kind: "number",
      expect: (d) => n(named(d.ClassType, "name", "Vinyasa").durationMinutes),
    },
    { q: "What should I bring to Yin?", kind: "text", expect: () => ["socks"] },
    {
      q: "Which classes are for advanced students?",
      kind: "names",
      expect: (d) => d.ClassType.filter((c) => c.level === "advanced").map((c) => c.name),
    },
    {
      q: "How many sessions are there of each class?",
      kind: "pairs",
      expect: (d) =>
        Object.fromEntries(
          d.ClassType.map((c) => [c.name, d.Session.filter((s) => s.classType === c.id).length]),
        ),
    },
    {
      q: "What is the biggest class we run, by places?",
      kind: "number",
      expect: (d) => Math.max(...d.Session.map((s) => n(s.capacity))),
    },
    {
      q: "Which teachers have a portrait?",
      kind: "names",
      // Pictures are not in the API (nor its tools): it cannot be answered there, so it is skipped.
      skip: "pictures are not in the API",
      expect: (d) => d.Instructor.filter((i) => i.portrait).map((i) => i.name),
    },
    { q: "How many instructors do we have?", kind: "number", expect: (d) => d.Instructor.length },
    {
      q: "Add a class type: Restorative, all levels, 60 minutes.",
      kind: "change",
      check: (a) => {
        const c = named(a.ClassType, "name", "Restorative");
        return c?.level === "allLevels" && n(c.durationMinutes) === 60;
      },
    },
    {
      q: "Power flow is called Power vinyasa from now on.",
      kind: "change",
      check: (a) =>
        Boolean(named(a.ClassType, "name", "Power vinyasa")) &&
        !named(a.ClassType, "name", "Power flow"),
    },
    {
      q: "Unpublish the post about summer sessions by the sea.",
      kind: "change",
      check: (a) => named(a.Post, "title", "Summer sessions by the sea")?.status === "draft",
    },
    {
      q: "Add an instructor: Liisa Koskinen. She teaches Yin and Hatha.",
      kind: "change",
      check: (a) => Boolean(named(a.Instructor, "name", "Liisa Koskinen")),
    },
    {
      q: "Foundations is 75 minutes now.",
      kind: "change",
      check: (a) => n(named(a.ClassType, "name", "Foundations")?.durationMinutes) === 75,
    },
    {
      q: 'Delete the post "Summer sessions by the sea".',
      kind: "change",
      check: (a, b) =>
        named(b.Post, "title", "Summer sessions by the sea") &&
        !named(a.Post, "title", "Summer sessions by the sea"),
    },
    {
      q: "Change Oskar Berg's bio to: Oskar teaches Vinyasa and Power flow.",
      kind: "change",
      check: (a) =>
        named(a.Instructor, "name", "Oskar Berg")?.bio === "Oskar teaches Vinyasa and Power flow.",
    },
  ],

  marketplace: [
    {
      q: "How many things are for sale?",
      kind: "number",
      expect: (d) => d.Item.filter((i) => i.available !== false).length,
    },
    {
      q: "What's the cheapest thing in electronics?",
      kind: "names",
      expect: (d) => [
        [...d.Item]
          .filter((i) => i.category === "electronics")
          .sort((a, b) => n(a.price) - n(b.price))[0].title,
      ],
    },
    {
      q: "Show me furniture under 100 €.",
      kind: "names",
      expect: (d) =>
        d.Item.filter((i) => i.category === "furniture" && n(i.price) < 100).map((i) => i.title),
    },
    {
      q: "What is for sale in Jomala?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.place === "Jomala").map((i) => i.title),
    },
    {
      q: "Which items are like new?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.condition === "likeNew").map((i) => i.title),
    },
    {
      q: "What is the most expensive item?",
      kind: "names",
      expect: (d) => [[...d.Item].sort((a, b) => n(b.price) - n(a.price))[0].title],
    },
    { q: "How many items per category?", kind: "pairs", expect: (d) => count(d.Item, "category") },
    {
      q: "What do the electronics cost together?",
      kind: "number",
      expect: (d) =>
        sum(
          d.Item.filter((i) => i.category === "electronics"),
          (i) => i.price,
        ),
    },
    {
      q: "What does the turntable cost?",
      kind: "number",
      expect: (d) => n(named(d.Item, "title", "Turntable").price),
    },
    {
      q: "Anything for kids?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.category === "kids").map((i) => i.title),
    },
    {
      q: "Which items are no longer available?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.available === false).map((i) => i.title),
    },
    {
      q: "How many items are in Mariehamn?",
      kind: "number",
      expect: (d) => d.Item.filter((i) => i.place === "Mariehamn").length,
    },
    {
      q: "What's the average price of everything listed, sold or not?",
      kind: "number",
      expect: (d) => Math.round((sum(d.Item, (i) => i.price) / d.Item.length) * 100) / 100,
    },
    {
      q: "Which items are worn?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.condition === "worn").map((i) => i.title),
    },
    { q: "Is there a road bike, and how big is its frame?", kind: "text", expect: () => ["56"] },
    {
      q: "The turntable is sold.",
      kind: "change",
      check: (a) => named(a.Item, "title", "Turntable")?.available === false,
    },
    {
      q: "Lower the price of the sailing dinghy to 950.",
      kind: "change",
      check: (a) => n(named(a.Item, "title", "Sailing dinghy with trailer")?.price) === 950,
    },
    {
      q: "Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund.",
      kind: "change",
      check: (a, b) =>
        a.Item.length === b.Item.length + 1 &&
        a.Item.some((i) => /tent/i.test(i.title) && i.category === "sports" && n(i.price) === 45),
    },
    {
      q: "Take the balance bike off the site.",
      kind: "change",
      check: (a, b) => {
        const x = named(a.Item, "title", "Balance bike");
        return Boolean(named(b.Item, "title", "Balance bike")) && (!x || x.available === false);
      },
    },
    {
      q: "The car roof box is in Jomala, not Mariehamn.",
      kind: "change",
      check: (a) => named(a.Item, "title", "Car roof box")?.place === "Jomala",
    },
  ],

  records: [
    { q: "How many items are in the collection?", kind: "number", expect: (d) => d.Item.length },
    {
      q: "Which are our favorites?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.kind === "favorite").map((i) => i.name),
    },
    {
      q: "What did we add last?",
      kind: "names",
      expect: (d) => [
        [...d.Item].sort((a, b) => String(b.addedOn).localeCompare(String(a.addedOn)))[0].name,
      ],
    },
    {
      q: "Which items were added in September 2026?",
      kind: "names",
      expect: (d) =>
        d.Item.filter((i) => String(i.addedOn).startsWith("2026-09")).map((i) => i.name),
    },
    {
      q: "How many items are archived?",
      kind: "number",
      expect: (d) => d.Item.filter((i) => i.kind === "archived").length,
    },
    {
      q: "Which items have a link?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => i.link).map((i) => i.name),
    },
    { q: "How many items of each kind?", kind: "pairs", expect: (d) => count(d.Item, "kind") },
    { q: "What do we know about the wall clock?", kind: "text", expect: () => ["1840"] },
    {
      q: "Which item came from a café?",
      kind: "names",
      expect: (d) => d.Item.filter((i) => /café|cafe/i.test(i.summary ?? "")).map((i) => i.name),
    },
    {
      q: "When was the brass ship's lamp added?",
      kind: "text",
      expect: (d) => [named(d.Item, "name", "Brass ship's lamp").addedOn],
    },
    {
      q: "Make the linen tablecloth a favorite.",
      kind: "change",
      check: (a) => named(a.Item, "name", "Linen tablecloth")?.kind === "favorite",
    },
    {
      q: "Archive the wool blanket.",
      kind: "change",
      check: (a) => named(a.Item, "name", "Wool blanket")?.kind === "archived",
    },
    {
      q: "Add a copper kettle we found today: a dented copper kettle from a summer house in Föglö.",
      kind: "change",
      check: (a, b) =>
        a.Item.length === b.Item.length + 1 && a.Item.some((i) => /copper kettle/i.test(i.name)),
    },
    {
      q: "Remove the enamel coffee pot.",
      kind: "change",
      check: (a, b) =>
        Boolean(named(b.Item, "name", "Enamel coffee pot")) &&
        !named(a.Item, "name", "Enamel coffee pot"),
    },
    {
      q: "The birch bark basket's link should be https://sv.wikipedia.org/wiki/Näver.",
      kind: "change",
      check: (a) =>
        named(a.Item, "name", "Birch bark basket")?.link === "https://sv.wikipedia.org/wiki/Näver",
    },
  ],
};

/** Whether an answer's text gives what the question asks (all but `change`, which reads records). */
export function answered(question, text, expected, also) {
  const flat = (s) => String(s).toLowerCase().replace(/\s+/g, " ");
  // "2,770.50", "2 770,50 €", "three": the same numbers.
  const WORDS = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
  ];
  const numbers = (s) => [
    ...[
      ...String(s)
        .replace(/(\d)[ \u00a0\u202f,.](?=\d{3}(?!\d))/g, "$1")
        .replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2")
        .matchAll(/-?\d+(?:\.\d+)?/g),
    ].map((m) => Number(m[0])),
    ...WORDS.flatMap((w, i) => (new RegExp(`\\b${w}\\b`, "i").test(String(s)) ? [i] : [])),
  ];
  const hasNumber = (s, x) => numbers(s).some((v) => Math.abs(v - x) < 0.01 + Math.abs(x) * 0.0005);
  const t = flat(text);
  if (question.kind === "number")
    return (
      hasNumber(text, expected) ||
      (also !== undefined && question.also.when.test(text) && hasNumber(text, also))
    );
  if (question.kind === "text")
    return expected.every((w) => t.includes(flat(w)) || dateIn(text, w));
  if (question.kind === "names")
    return expected.length
      ? expected.every((w) => t.includes(flat(w)))
      : // "None", or that all of them have it ("All customers have placed at least one order").
        /\b(no|none|nothing|not any|zero|0)\b/.test(t) ||
          /\b(all|every|each)\b.*\b(ha(ve|s)|are|is)\b/.test(t);
  if (question.kind === "pairs")
    return Object.entries(expected).every(([k, v]) => {
      const at = t.indexOf(flat(k));
      return at >= 0 && hasNumber(t.slice(Math.max(0, at - 40), at + k.length + 40), v);
    });
  return false;
}

/** A date written another way: 2026-10-14 as "14 October", "October 14" or "14.10.". */
function dateIn(text, iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return false;
  const month = new Date(`${m[1]}-${m[2]}-01T00:00:00Z`)
    .toLocaleString("en", { month: "long", timeZone: "UTC" })
    .toLowerCase();
  const day = String(Number(m[3]));
  const t = text.toLowerCase();
  return (
    t.includes(`${day} ${month}`) ||
    t.includes(`${month} ${day}`) ||
    t.includes(`${day}.${Number(m[2])}.`)
  );
}
