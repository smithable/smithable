// JSON Schemas of the companion files, written from their validators (auth.ts, ux.ts,
// content.ts; the context file's schema is in context-file.ts and is the validator itself).
// They are published beside smithable.yml's for editors (yaml-language-server), and Studio's
// editor offers their keys and explains them from the descriptions here. The validators stay
// the judges: a schema says what may stand where, not every rule between the files.
import { AUTH_VERSION, PROVIDERS } from "./auth.js";
import { CONTENT_VERSION, LANGUAGES } from "./content.js";
import { CONTEXT_SCHEMA } from "./context-file.js";
import type { JsonSchema } from "./section.js";
import { FONTS } from "./theme.js";
import { CONTROLS, ICONS, SECTION_LOOKS, THEME_PRESETS, TONES, UX_VERSION } from "./ux.js";

const strings = (description: string): JsonSchema => ({
  type: "array",
  items: { type: "string" },
  description,
});
const roles = (description: string): JsonSchema => ({
  type: "array",
  items: { type: "string" },
  description,
});
const text = (description: string): JsonSchema => ({ type: "string", description });
const grant = (description: string): JsonSchema => ({
  oneOf: [{ enum: ["all"] }, { type: "array", items: { type: "string" } }],
  description,
});

const readWhere: JsonSchema = {
  oneOf: [
    { type: "string", description: "A model anyone may read." },
    {
      type: "object",
      description:
        "A model with only the records that have these values: { Post: { where: { status: published } } }.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["where"],
        properties: {
          where: {
            type: "object",
            description:
              "A choice field's value or a list of them, or a yes/no field's true or false.",
          },
        },
      },
    },
  ],
};

export const AUTH_SCHEMA: JsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: `https://docs.smithable.ai/schema/smithable-auth-${AUTH_VERSION}.json`,
  title: "smithable.auth.yml",
  description: "Who signs in, the roles, the default access, and what is public.",
  type: "object",
  required: ["smithableAuth"],
  additionalProperties: false,
  properties: {
    smithableAuth: {
      description: "The file format version.",
      enum: [Number(AUTH_VERSION), AUTH_VERSION],
    },
    signIn: {
      description:
        '"none" for an app without sign-in (only "public" is reachable then), or how people sign in.',
      oneOf: [
        { const: "none" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            providers: {
              type: "array",
              items: { enum: [...PROVIDERS] },
              description: `The sign-in methods, in button order: ${PROVIDERS.join(", ")}.`,
            },
            allowedDomains: strings(
              "Only addresses on these domains may sign up, e.g. [acme.example].",
            ),
            selfSignUp: {
              type: "boolean",
              description:
                "Whether anyone with an account at a provider may sign up (true by default); false lets only invited addresses and the admins sign in.",
            },
          },
        },
      ],
    },
    defaultAccess: {
      enum: ["shared", "private"],
      description:
        "The default access to records: shared (colleagues see each other's) or private (each sees their own).",
    },
    roles: {
      type: "object",
      description:
        "The roles, by name (camelCase): all (the whole app; always admin's), or a block with a description and what the role may do beyond the record rule. admin always exists, and so does a role for everyone else: member, when none is named.",
      additionalProperties: {
        oneOf: [
          { type: "null" },
          { enum: ["all"], description: "The whole app." },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              description: text("What the role is for, in a sentence."),
              pages: grant("Pages the role may open; all is every page but the administrators'."),
              read: grant("Models whose every record the role reads (with private access)."),
              create: grant("Models the role may add records of."),
              write: grant("Models whose every record the role may change."),
              delete: grant("Models whose every record the role may delete."),
              actions: grant("Custom actions the role may run (a standard action follows write)."),
              review: grant(
                "Models whose waiting pictures and files the role approves or rejects; opens the review page for them.",
              ),
            },
          },
        ],
      },
    },
    defaultRole: text("The role new users get; never admin."),
    admins: strings(
      "Email addresses that get the admin role when they first sign in, and may always sign in.",
    ),
    public: {
      type: "object",
      description: "What anyone may open, read or create without signing in.",
      additionalProperties: false,
      properties: {
        pages: strings("Pages anyone may open (the sign-in page always is)."),
        read: {
          type: "array",
          items: readWhere,
          description: "Models anyone may read, or only the records of them with certain values.",
        },
        create: strings("Models anyone may create a record of, e.g. a contact form's."),
      },
    },
    api: {
      type: "object",
      description:
        "What other programs may reach with a key, under /api/v1. A key is made in the app by an administrator, with a role, and that role's access decides what it may do.",
      additionalProperties: false,
      required: ["models"],
      properties: {
        models: {
          description: "all (also models added later), or the models other programs may reach.",
          oneOf: [{ const: "all" }, strings("The models, e.g. [Customer, Order].")],
        },
        except: strings("With all: the models left out."),
        actions: {
          description: "Standard actions of the offered models they may run: all, or a list.",
          oneOf: [{ const: "all" }, strings("The actions, e.g. [markPaid].")],
        },
        assistants: {
          description:
            "true offers the same to AI assistants as tools (/mcp); { delete: true } lets them delete too.",
          oneOf: [
            { type: "boolean" },
            {
              type: "object",
              additionalProperties: false,
              properties: { delete: { type: "boolean" } },
            },
          ],
        },
      },
    },
    assistant: {
      type: "object",
      description:
        '"Ask", the assistant in the app, for the people who use it. It acts as the person asking.',
      additionalProperties: false,
      required: ["for"],
      properties: {
        for: {
          description:
            "Who gets it: the roles ([admin, staff]), or signed-in (everyone who signs in), or anyone (visitors too, answered by the app's wording rules over what is public, never by a model).",
          oneOf: [{ enum: ["signed-in", "anyone"] }, roles("The roles that get it.")],
        },
        may: {
          enum: ["read", "change"],
          description:
            "read (the default): it finds, counts and adds up; change: it also adds, changes and runs standard actions, each confirmed by the person. It never deletes.",
        },
      },
    },
  },
};

const look = Object.fromEntries(
  Object.entries(SECTION_LOOKS).map(([kind, options]) => [
    kind,
    {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(options ?? {}).map(([option, values]) => [
          option,
          values === "text"
            ? { type: "string", description: "The name of the item to set apart." }
            : {
                enum: [...values],
                description: `One of ${values.join(", ")}; the first is the default.`,
              },
        ]),
      ),
    } satisfies JsonSchema,
  ]),
);

export const UX_SCHEMA: JsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: `https://docs.smithable.ai/schema/smithable-ux-${UX_VERSION}.json`,
  title: "smithable.ux.yml",
  description: "How the app looks: the theme, icons, columns, forms and the sections' looks.",
  type: "object",
  required: ["smithableUx"],
  additionalProperties: false,
  properties: {
    smithableUx: {
      description: "The file format version.",
      enum: [Number(UX_VERSION), UX_VERSION],
    },
    theme: {
      type: "object",
      description:
        "The app's theme: a preset, the owner's colours and font, the density and the motion.",
      additionalProperties: false,
      properties: {
        preset: {
          type: "string",
          description: `A built-in theme (${THEME_PRESETS.join(", ")}) or one of the project's own (themes/<name>.yml).`,
        },
        brand: {
          type: "object",
          description: "The owner's own colours and font, over the preset.",
          additionalProperties: false,
          properties: {
            primary: text("The main colour, as #rrggbb."),
            background: text("A background colour, as #rrggbb: a wash of its hue in both modes."),
            font: { enum: [...FONTS], description: `The font: ${FONTS.join(", ")}.` },
          },
        },
        density: {
          enum: ["comfortable", "standard", "compact"],
          description: "How much space the lists and forms take.",
        },
        motion: {
          enum: ["none", "subtle", "lively"],
          description: "How much moves: none, subtle (the default) or lively.",
        },
      },
    },
    pages: {
      type: "object",
      description: "Each page's look, by the page's name.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          icon: { enum: [...ICONS], description: "The page's icon in the navigation." },
          table: {
            type: "object",
            description:
              "A list page's table: its columns, their order, the default sort and the view.",
            additionalProperties: false,
            properties: {
              columns: strings("The fields shown as columns, in order."),
              below: {
                type: "object",
                description:
                  "A field shown under another in its column, e.g. { email: phone }: the phone number under the email.",
                additionalProperties: { type: "string" },
              },
              sort: text(
                'The field the list is sorted by, with "-" in front for the highest first, e.g. -createdAt.',
              ),
              view: {
                enum: ["table", "cards"],
                description: "On a wide screen: a table, or cards (a phone shows cards anyway).",
              },
            },
          },
          filters: {
            type: "object",
            description:
              'A list page\'s filters: shown, the ones shown when the list is first reached; the rest fold behind "More filters".',
            additionalProperties: false,
            properties: {
              shown: strings(
                "The filters shown at once, from the page's filters in smithable.yml.",
              ),
            },
          },
          record: {
            type: "object",
            description: "The record page: how its lists of related records are shown.",
            additionalProperties: false,
            properties: {
              lists: {
                type: "object",
                description:
                  "By list field: table (the default) or thread, a conversation with a reply box, e.g. { messages: thread }.",
                additionalProperties: { enum: ["thread", "table"] },
              },
              subtitle: {
                type: "string",
                description:
                  "The line under a record's name on cards and in pickers: a field, a reference or a field one reference away (instructor.name).",
              },
              detail: {
                type: "array",
                items: { type: "string" },
                description: "Smaller parts after the subtitle, e.g. [classType.level, capacity].",
              },
            },
          },
          form: {
            type: "object",
            description: "The page's form: the fields' order, sections, columns and controls.",
            additionalProperties: false,
            properties: {
              fieldOrder: strings("The fields in the order the form shows them."),
              sections: {
                type: "object",
                description:
                  "Headings over groups of fields: { contact: [email, phone] }; the heading's text is in smithable.content.yml.",
                additionalProperties: strings("The fields under the heading."),
              },
              columns: {
                enum: [1, 2],
                description:
                  "2 puts short fields two abreast; long texts and pictures stay full width.",
              },
              control: {
                type: "object",
                description: `How a field is entered: ${CONTROLS.join(", ")}; input is the default for its kind.`,
                additionalProperties: { enum: [...CONTROLS] },
              },
              results: {
                enum: ["beside", "below"],
                description:
                  "A calculator page: the results beside the inputs (the default) or below them.",
              },
            },
          },
          frame: {
            enum: ["site", "app", "none"],
            description:
              "The frame the page shows in: site (the public frame with the top menu), app (the workspace with the side menu) or none (the page alone). Without it, the page kind's own.",
          },
          sections: {
            type: "object",
            description:
              "A landing page's sections' looks, by section name: a hero's layout, a feature list's columns.",
            additionalProperties: { oneOf: Object.values(look) },
          },
          theme: {
            type: "object",
            description:
              "A landing page's own theme, over the app's: { preset: playful }, with brand, density and motion as the app's theme takes them.",
            additionalProperties: false,
            properties: {
              preset: text("A built-in theme or one of the project's."),
              brand: { type: "object", description: "The colours and font, as the app's brand." },
              density: {
                enum: ["comfortable", "standard", "compact"],
                description: "The page's density.",
              },
              motion: { enum: ["none", "subtle", "lively"], description: "The page's motion." },
            },
          },
        },
      },
    },
    assistant: {
      type: "object",
      description:
        "Ask, the assistant in the app: its manner, as a theme is a manner (its texts are smithable.content.yml's).",
      additionalProperties: false,
      properties: {
        voice: {
          enum: ["plain", "friendly", "formal"],
          description: "plain (the default: short, no pleasantries), friendly or formal.",
        },
      },
    },
    aiBadge: {
      type: "boolean",
      description:
        'Whether pictures an AI made carry the badge ("AI-generated", "AI"): on unless you switch it off; whether your audience needs it is your responsibility.',
    },
    tones: {
      type: "object",
      description:
        "The meaning of a choice field's values, shown as the badge's colour: { \"Order.status\": { paid: success, overdue: danger } }.",
      additionalProperties: {
        type: "object",
        additionalProperties: {
          enum: [...TONES],
          description: `${TONES.join(", ")}; values not listed are neutral.`,
        },
      },
    },
  },
};

const items = (keys: string[], what: string): JsonSchema => ({
  type: "array",
  description: what,
  items: {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      keys.map((k) => [
        k,
        k === "features" ? strings("The plan's features, one per line.") : { type: "string" },
      ]),
    ),
  },
});
const section: JsonSchema = {
  type: "object",
  description: "A landing page's section's texts, by the section's name in smithable.yml.",
  additionalProperties: false,
  properties: {
    title: text("The section's heading."),
    subtitle: text("A hero's line under the heading."),
    text: text("A paragraph under the heading."),
    button: text("The button's text."),
    image: {
      type: "object",
      description: "A hero's picture: { src: /images/hero.webp, alt: what it shows }.",
      additionalProperties: false,
      properties: {
        src: { type: "string" },
        alt: { type: "string" },
        generated: {
          type: "boolean",
          description:
            "Made by an AI: the app marks it as such where it could pass for a photograph.",
        },
      },
    },
    items: {
      type: "array",
      description:
        "The section's items: features, plans, testimonials, questions, pictures, footer links.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          text: { type: "string" },
          name: { type: "string" },
          price: { type: "string" },
          period: { type: "string" },
          features: strings("A plan's features."),
          button: { type: "string" },
          quote: { type: "string" },
          role: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          image: {
            type: "object",
            description: "A gallery picture: { src: images/…, alt: what it shows }.",
            additionalProperties: false,
            properties: {
              src: { type: "string" },
              alt: { type: "string" },
              generated: {
                type: "boolean",
                description:
                  "Made by an AI: the app marks it as such where it could pass for a photograph.",
              },
            },
          },
          caption: { type: "string" },
          label: { type: "string" },
          link: { type: "string" },
        },
      },
    },
    address: text("A contact section's address, one line per line."),
    phone: text("A contact section's phone number."),
    email: text("A contact section's email address."),
    hours: text("Opening hours, one per line."),
    thanks: text("What a visitor reads once the form is sent."),
    name: text("A privacy page's operator: who runs the app (pages.<page>.operator)."),
    country: text("The operator's country."),
    hosting: text('Where the app is hosted, as a phrase: "in the EU", "in Stockholm".'),
    results: text("A calculator section's results heading."),
    label: text("A dashboard tile's label."),
    fields: {
      type: "object",
      description: "A calculator section's fields' labels and help.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" }, help: { type: "string" } },
      },
    },
  },
};

export const CONTENT_SCHEMA: JsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: `https://docs.smithable.ai/schema/smithable-content-${CONTENT_VERSION}.json`,
  title: "smithable.content.yml",
  description:
    "Visible text that should read differently from what the names give, and the app's language.",
  type: "object",
  required: ["smithableContent"],
  additionalProperties: false,
  properties: {
    smithableContent: {
      description: "The file format version.",
      enum: [Number(CONTENT_VERSION), CONTENT_VERSION],
    },
    language: {
      enum: [...LANGUAGES],
      description: `The language of everything a person reads in the app (the app's own words follow it): ${LANGUAGES.join(", ")}; en is the default.`,
    },
    languages: {
      type: "array",
      items: { enum: [...LANGUAGES] },
      uniqueItems: true,
      description:
        "The other languages the app is offered in, each with its file smithable.content.<language>.yml of the same texts (docs/design/languages.md).",
    },
    logo: {
      type: "object",
      description:
        "The app's mark, before its name in the menu and the landing page's header, and its tab icon: { src: images/logo.webp, alt: what it shows }.",
      required: ["src", "alt"],
      additionalProperties: false,
      properties: {
        src: {
          type: "string",
          description: "A file under public/images/: webp, avif, jpg, png or svg.",
        },
        alt: { type: "string", description: "What the mark shows." },
        generated: { type: "boolean", description: "Made by an AI (a mark is never badged)." },
      },
    },
    models: {
      type: "object",
      description: "Each model's texts, by the model's name.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: text(
            'The singular, e.g. "Client"; the plural follows unless pluralLabel says otherwise.',
          ),
          pluralLabel: text(
            'The plural, e.g. "Clients". In another language than English, give it.',
          ),
          fields: {
            type: "object",
            description: "Each field's texts, by the field's name.",
            additionalProperties: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: text("The field's label."),
                help: text("A line under the form field."),
                values: {
                  type: "object",
                  description: "A choice field's values' texts: { smb: Small business }.",
                  additionalProperties: { type: "string" },
                },
              },
            },
          },
          reserve: {
            type: "object",
            description: "A model with a capacity: the reservation block's words.",
            additionalProperties: false,
            properties: {
              book: text("The button to take a place."),
              cancel: text("The button to give it up."),
              full: text("When no place is left."),
              booked: text("When the viewer has a place."),
            },
          },
        },
      },
    },
    pages: {
      type: "object",
      description:
        "Each page's texts, by the page's name: its title and subtitle, and its sections' or tiles' texts by their names.",
      additionalProperties: {
        type: "object",
        properties: {
          title: text("The page's heading and menu entry."),
          subtitle: text("A line under the heading."),
          description: text(
            "What search engines show under the page's name, one or two sentences; for a public page.",
          ),
          form: {
            type: "object",
            description:
              "The form's sections' headings: { sections: { contact: { title: How to reach them } } }.",
            additionalProperties: false,
            properties: {
              sections: {
                type: "object",
                description: "Each section's heading, by the section's name in smithable.ux.yml.",
                additionalProperties: {
                  type: "object",
                  additionalProperties: false,
                  properties: { title: { type: "string" } },
                },
              },
            },
          },
          fields: {
            type: "object",
            description: "A calculator page's fields' labels and help.",
            additionalProperties: {
              type: "object",
              additionalProperties: false,
              properties: { label: { type: "string" }, help: { type: "string" } },
            },
          },
          results: {
            type: "object",
            description: "A calculator page's results heading.",
            additionalProperties: false,
            properties: { title: { type: "string" } },
          },
        },
        additionalProperties: section,
      },
    },
    consent: {
      type: "object",
      description:
        "The consent bar's words, when the app asks for consent (analytics that need it, or custom code): the sentence, and the two buttons.",
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "The sentence that says what the yes is for." },
        accept: { type: "string", description: "The button that says yes." },
        decline: { type: "string", description: "The button that says no." },
      },
    },
    assistant: {
      type: "object",
      description:
        "Ask, the assistant in the app: its visible texts, in the app's language (who gets it is smithable.auth.yml's; its voice smithable.ux.yml's).",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: 'The panel\'s name, "Ask" by default, e.g. Nova.' },
        greeting: { type: "string", description: "The first line it shows." },
        placeholder: { type: "string", description: "The question box's placeholder." },
        about: {
          type: "string",
          description:
            "One sentence of what it is for, shown under the greeting and given to the model.",
        },
      },
    },
    menus: {
      type: "object",
      description: "A named menu's heading: { admin: { label: Administration } }.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" } },
      },
    },
    actions: {
      type: "object",
      description:
        "An action's words, by its name in smithable.yml: { resolve: { label: Mark as resolved, help: Closes the case for good. } }. The label is its button and its page's title, else its name in words; the help is the button's tooltip and a line under its dialog's title.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" }, help: { type: "string" } },
      },
    },
    outgoing: {
      type: "object",
      description:
        "An outgoing mail's words, by its name in smithable.yml: { bookingMade: { subject: Your booking, text: Thank you! } }. The record follows the text.",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject: { type: "string", description: "The mail's subject; else the record's title." },
          text: { type: "string", description: "A sentence or two above the record's details." },
        },
      },
    },
  },
};

/** Every companion file's schema, by the file it is for. */
export const COMPANION_SCHEMAS: Record<string, JsonSchema> = {
  "smithable.auth.yml": AUTH_SCHEMA,
  "smithable.ux.yml": UX_SCHEMA,
  "smithable.content.yml": CONTENT_SCHEMA,
  "smithable.context.yml": {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://docs.smithable.ai/schema/smithable-context-0.1.json",
    title: "smithable.context.yml",
    description:
      "Implementation choices: the adapter, the database, conventions, packages, plugins and the AI policy. The only file that may name technologies.",
    ...CONTEXT_SCHEMA,
    properties: described((CONTEXT_SCHEMA.properties ?? {}) as Record<string, JsonSchema>, {
      smithableContext: "The file format version.",
      adapter: "The adapter that generates the app (tanstack).",
      database: "The database the app stores its records in (sqlite).",
      conventions:
        "Conventions custom code follows, one per line, for people and models writing it.",
      guidance: "What a model writing custom code should know about this app.",
      plugins: "The project's own plugins (smithable/plugins/<name>/), by name.",
      packages: "Libraries for custom code: name to exact version.",
      ai: "Where a model may run: the policy, and with custom the models allowed.",
      "ai.policy":
        "local-only, eu-only, best-available (the default when nothing is said), or custom.",
      "ai.allow": "With custom: the models allowed, by name.",
      analytics:
        "Counting visits with one provider and the app's id with it, in production builds only. Google needs the visitor's consent, so it turns on the consent bar; the others keep no cookies.",
      "analytics.plausible":
        "Plausible: the app's domain as Plausible knows it, e.g. shop.example.com.",
      "analytics.umami": "Umami (its hosted service): the website id.",
      "analytics.fathom": "Fathom: the site id, eight capital letters or digits.",
      "analytics.google":
        "Google Analytics: the measurement id, e.g. G-XXXXXXXXXX. Asks for consent first.",
    }),
  },
};

/** The properties with descriptions put on them ("a.b" reaches into a property's own). */
function described(
  properties: Record<string, JsonSchema>,
  texts: Record<string, string>,
): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const [key, node] of Object.entries(properties)) {
    const inner = Object.fromEntries(
      Object.entries(texts)
        .filter(([k]) => k.startsWith(`${key}.`))
        .map(([k, v]) => [k.slice(key.length + 1), v]),
    );
    out[key] = {
      ...node,
      ...(texts[key] ? { description: texts[key] } : {}),
      ...(node.properties && Object.keys(inner).length
        ? { properties: described(node.properties as Record<string, JsonSchema>, inner) }
        : {}),
    };
  }
  return out;
}
