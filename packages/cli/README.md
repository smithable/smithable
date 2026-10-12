# smithable

Smithable builds business apps from a short description of the app, `smithable.yml`, and keeps them working as they change. Routine changes, such as a field, a page, a role or a rule, are operations that need no AI model. A request in your own words goes to the cheapest model that can handle it, and you confirm the change before it applies. The generated app is an ordinary TanStack Start app with React, Tailwind, shadcn/ui, Drizzle and SQLite. It does not depend on Smithable, and the code is yours.

This package is the `smithable` command: it makes apps, changes them, runs Studio (the editor in the browser), serves the operations to AI assistants over MCP, and builds, deploys and backs up apps.

## Try it

Node 24, then:

```sh
npx smithable@latest new my-crm        # a CRM from the starter, with sample data
cd my-crm && npx smithable studio      # the editor, in the browser
```

Or install it once with `npm install -g smithable`, then `smithable --help` lists every command. `npm create smithable` starts an app too.

## Links

- Website: https://smithable.ai
- Documentation: https://docs.smithable.ai
- Source and issues: https://github.com/smithable/smithable

## Licence

Apache-2.0. Apps you generate carry no obligations to Smithable: the app kit and templates are 0BSD.
