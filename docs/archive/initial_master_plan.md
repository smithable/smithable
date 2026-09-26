# Smithable — Master Implementation Plan

## 1. Product definition

Smithable is an open-source, local-first, manifest-driven full-stack application builder inspired by:

- Rails: convention over configuration, generators, strong defaults, concise code
- Lovable: visual application building, prompt-driven changes, immediate preview
- traditional RAD/model-driven development: declarative application structure
- modern coding agents: optional AI assistance for interpretation and complex logic

Smithable must NOT be designed as:

> Prompt → LLM → arbitrary source-code edits.

The preferred architecture is:

```text
Human intent
     |
     v
Can Smithable perform this deterministically?
     |
   yes ----------------------> deterministic operation
     |
    no
     v
Can a small local model interpret it safely?
     |
   yes ----------------------> local semantic model
     |
    no
     v
Use configured stronger model
     |
     v
Smithable semantic change
     |
     v
compiler / generators / adapters
     |
     v
ordinary maintainable application
```

The goal is to use as little AI inference as practical.

---

# 2. Primary product benefits

Smithable should optimize around four core benefits.

## 2.1 Very low AI/token usage

Smithable understands the application semantically.

AI should not repeatedly read an entire repository to understand:

- what pages exist
- what models exist
- what an action does
- where functionality is implemented
- which tests relate to a feature

Use:

- semantic manifests
- generated implementation index
- deterministic operations
- narrow context retrieval
- local small models for interpretation

Use frontier/cloud AI only when actual reasoning or generation is required.

Token efficiency should eventually be benchmarked against conventional coding-agent workflows.

Example:

```text
Task:
"Add phone number to Customer"

Traditional agent:
reads repository
finds schema
finds form
finds API
finds tests
modifies many files

Smithable:
addField(Customer, phone, phone)

AI tokens:
0
```

---

## 2.2 Open source

The local Smithable product must be genuinely useful without:

- Smithable subscription
- Smithable Cloud
- Smithable-managed inference
- proprietary runtime
- mandatory remote account

Users must be able to:

```text
clone repository
install Smithable
use local or BYO models
build applications
run applications
build OCI containers
deploy independently
```

Generated applications must remain usable if Smithable disappears.

---

## 2.3 One-click deployment

Every Smithable-native application should conform to a common deployment contract.

Default output:

```text
OCI container
+
environment configuration
+
persistent storage contract
+
health endpoint
+
stdout/stderr logging
```

Initial simple deployment:

```text
one application instance
SQLite
persistent /data volume
```

Future scalable mode:

```text
multiple instances
PostgreSQL
S3-compatible object storage
```

Smithable Cloud must use the same deployment artifact that users can self-host.

---

## 2.4 Local-first, EU second

Execution priority:

```text
1. Deterministic/local Smithable
2. Local model
3. EU-hosted managed AI
4. User-selected external/frontier model
```

Smithable should work offline for a meaningful subset of development.

Default managed AI should preferably be hosted in Europe.

A user or company must be able to configure Smithable so that:

```text
source code never leaves device/company network
```

Support:

- local model
- customer-hosted model
- EU-hosted provider
- BYO OpenAI-compatible endpoint
- optional Anthropic/OpenAI/etc.

Do not make US-hosted services architectural dependencies.

---

# 3. Rails-inspired philosophy

Smithable should strongly prefer convention over configuration.

There should normally be one conventional way to:

- define a domain model
- add a field
- define a relationship
- create CRUD functionality
- create a page
- create navigation
- define validation
- define permissions
- expose an action
- create a scheduled job
- create tests
- persist files
- deploy the application

Avoid asking AI to make architectural choices when Smithable can make them.

Example conceptual operations:

```text
createModel(Customer)
addField(Customer, email, email)
addRelation(Customer, orders, hasMany, Order)
createCrudPage(Customer)
requirePermission(deleteCustomer, admin)
createScheduledJob(generateInvoices, daily)
```

These operations should be callable from:

```text
Visual editor
CLI
AI interpretation
APIs/plugins
```

All interfaces must ultimately call the same semantic operation layer.

---

# 4. DRY and non-verbose code

A major goal is keeping generated applications small and understandable.

Avoid Rails-style scaffolding that produces excessive boilerplate.

Do NOT routinely generate:

```text
CustomerController
CustomerRepository
CustomerService
CustomerDTO
CustomerMapper
CustomerValidator
CustomerForm
CustomerTable
```

if the same functionality can be derived from metadata and reusable primitives.

Prefer:

```tsx
<ModelForm model="Customer" />
```

where appropriate.

Allow custom application code when behavior diverges from convention.

Target architecture:

```text
conventions/runtime        handles common behavior
generators/compiler        handles structural differences
custom code                handles application-specific logic
AI                         handles interpretation/complex reasoning
```

Never duplicate the same domain definition across:

- database schema
- validation
- API typing
- forms
- documentation

Derive as much as practical from the semantic model.

---

# 5. Core semantic source: `smithable.yml`

`smithable.yml` is the authoritative source of truth for application FUNCTIONALITY.

It must be technology-neutral.

It describes WHAT the application does.

It must not describe React, TanStack, Drizzle, SQL implementation files, Tailwind classes, etc.

Initial conceptual areas:

```yaml
smithable: 1

app:
  name: CRM

models:
  Customer:
    fields:
      name:
        type: string
        required: true
      email:
        type: email
      phone:
        type: phone

    relationships:
      orders:
        type: hasMany
        model: Order

pages:
  customers:
    route: /customers
    purpose: Manage customers
    capabilities:
      - listCustomers
      - createCustomer
      - editCustomer

actions:
  createCustomer:
    type: create
    model: Customer
    permission: customers.write

permissions:
  customers.write:
    roles:
      - admin
      - salesperson

navigation:
  - page: customers

jobs:
  generateInvoices:
    schedule: daily
```

Exact syntax must be designed carefully rather than copied blindly from this example.

---

# 6. Keep the manifest small

Do not attempt to model every detail of arbitrary software.

Initial specification should focus on:

- models
- fields
- relationships
- pages
- views
- navigation
- queries
- commands/actions
- permissions
- jobs
- integrations
- external endpoints

Code remains the escape hatch for complicated behavior.

Do not turn `smithable.yml` into a general-purpose programming language.

Rule:

> Manifest defines application intent and standard behavior. Custom code defines exceptional behavior.

---

# 7. Reuse open standards

Do not invent standards unnecessarily.

Use concepts from:

- JSON Schema for types and validation
- OpenAPI for explicit external HTTP APIs
- AsyncAPI later if event-driven integrations require it
- OCI for deployment images

Smithable should provide the higher-level application model connecting these pieces.

The Smithable manifest itself should be openly documented and versioned.

Provide a JSON Schema for editor validation/autocomplete.

---

# 8. Technology context: `smithable.context.yml`

Use a separate structured context file describing implementation technology and project-specific AI guidance.

Recommended name:

```text
smithable.context.yml
```

This is human/AI-editable.

Example direction:

```yaml
smithableContext: 1

implementation:
  adapter: tanstack

stack:
  language: typescript
  framework: tanstack-start
  frontend: react
  styling: tailwind
  components: shadcn
  orm: drizzle
  database: sqlite

conventions:
  preferComposition: true
  keepCodeDry: true
  avoidBoilerplate: true
  preferGeneratedOperations: true

deployment:
  runtime: oci
  port: 3000
  dataDirectory: /data

agent:
  principles:
    - Prefer Smithable semantic operations over source edits.
    - Never duplicate functionality already represented in smithable.yml.
    - Prefer existing components before creating new ones.
    - Keep implementation concise.
```

Provide a schema.

Allow a free-form notes section for unusual project information.

---

# 9. Generated implementation index

Create a generated bridge between the semantic application model and actual implementation.

Do NOT put implementation paths in `smithable.yml`.

Conceptual layers:

```text
1. smithable.yml
   application intent

2. smithable.context.yml
   technology/policy

3. generated implementation index
   where functionality is implemented

4. actual code
```

Use an internal generated index.

Prefer SQLite for larger/real projects rather than a giant JSON/YAML file.

Example:

```text
.smithable/
  index.db
  cache/
```

The index should map:

```text
Smithable concept
<-> source symbols
<-> routes
<-> DB structures
<-> UI components
<-> tests
<-> permissions
<-> visual elements
```

Example semantic query:

```text
inspectConcept("action:createCustomer")
```

returns:

```yaml
concept: action:createCustomer

semantic:
  model: Customer
  permission: customers.write

implementation:
  handler:
    file: src/features/customers/actions.ts
    symbol: createCustomer

  validation:
    file: src/features/customers/schema.ts
    symbol: createCustomerInput

  page:
    id: customers

tests:
  - tests/customers.spec.ts
```

The AI should receive this narrow structured result rather than searching the entire repository.

---

# 10. Smithable Intermediate Representation

Do not couple the Smithable manifest directly to TanStack.

Pipeline:

```text
smithable.yml
     |
     v
parser
     |
     v
validated semantic model
     |
     v
Smithable IR
     |
     v
technology adapter
     |
     v
ordinary implementation
```

The IR is technology-independent.

---

# 11. Technology adapters

Smithable itself should be technology-independent.

Smithable Native should initially support ONE stack well.

Initial adapter:

```text
TanStack Start
React
TypeScript
Tailwind
shadcn/ui
Drizzle
SQLite
Vite
```

Architectural contract:

```text
Smithable IR
     |
     +---- adapter-tanstack
     +---- future adapter-rails
     +---- future adapter-django
     +---- future adapter-dotnet
```

Do NOT build Rails/Django/etc. initially.

Publish an adapter API so community adapters can be built later.

Possible adapter responsibilities:

```text
implementModel()
implementField()
implementRelation()
implementAction()
implementPage()
implementPermission()
findImplementation()
validateImplementation()
buildApplication()
runApplication()
generateMigration()
```

---

# 12. Compatibility levels

Existing projects should be classified.

```text
Smithable Native
Supported Adapter
Agent-only
Unsupported
```

## Smithable Native

Full:

- manifest-driven development
- deterministic operations
- WYSIWYG
- semantic index
- deployment
- low-context AI

## Supported Adapter

Some/all Smithable semantic features supported by another adapter.

## Agent-only

Smithable can:

- open
- run
- preview
- invoke coding agent
- maybe deploy

but cannot guarantee semantic operations.

## Unsupported

Smithable cannot safely operate it.

Conversion must be explicit and performed on a branch/copy.

---

# 13. Initial application stack

Generated Smithable Native applications should use:

```text
TanStack Start
React
TypeScript
Tailwind
shadcn/ui
Drizzle ORM
SQLite
Playwright
OCI/Docker
```

Keep stack-specific knowledge in the adapter.

Do not make the Smithable specification depend on TanStack concepts.

---

# 14. Smithable implementation language

Build Smithable primarily in TypeScript.

Use:

## Studio

```text
React
TypeScript
Vite
Tailwind
shadcn/ui
```

Studio itself does not need SSR.

## Local daemon / CLI / compiler

```text
Node.js
TypeScript
```

Responsibilities include:

- filesystem
- Git
- spawning processes
- AI providers
- Docker
- Playwright
- security scanners
- application process
- database/index
- deployment

## Desktop packaging

Start with Electron.

Reason:

- easiest Node integration
- easy child processes
- filesystem access
- detachable windows
- one-language stack
- mature installers

Tauri may be considered later if Electron overhead becomes materially problematic.

---

# 15. Desktop architecture

Desktop should be one client of a reusable daemon.

```text
Smithable Desktop
       |
       v
Smithable daemon
       |
       +-- compiler
       +-- project files
       +-- Git
       +-- agents
       +-- app server
       +-- Docker
       +-- security
       +-- deployment
```

Keep daemon protocol reusable.

Future:

```text
Browser -> remote Smithable worker
Enterprise browser -> internal Smithable daemon
```

---

# 16. CLI

Ship a CLI even if Desktop is the primary UX.

Examples:

```text
smithable .
smithable validate
smithable generate
smithable test
smithable security
smithable build
smithable run
smithable deploy
```

Desktop and CLI must use the same core implementation packages.

---

# 17. Installer

Produce normal desktop installers.

Target initially:

```text
Windows installer
macOS package
```

Linux later.

Bundle:

- Electron runtime
- Smithable Studio
- Node runtime
- daemon
- CLI
- default templates

Do not require users to install a specific Node version manually.

Detect external optional tools such as:

- Git
- Docker
- Claude Code
- Ollama
- other local inference runtimes

---

# 18. Visual editor

Smithable Studio is a normal HTML/React application.

The edited application runs in an iframe.

Do not build the actual app as one giant contenteditable HTML document.

Layout concept:

```text
+--------------------------------------------------+
| Main toolbar                                     |
+--------------+-----------------------------------+
| Toolbox      | Application preview               |
|              |                                   |
| Pages        | iframe                            |
| Models       |                                   |
| Components   |                                   |
| Data         |                                   |
| Security     |                                   |
+--------------+-----------------------------------+
| Prompt / agent output                            |
+--------------------------------------------------+
```

Panels should be:

- dockable
- resizable
- hideable
- detachable to another window

AI panel defaults to bottom.

Toolbox must be customizable.

---

# 19. Visual instrumentation

Add development-only instrumentation.

Use:

```text
Smithable Vite plugin
+
small Smithable editor runtime
```

Map:

```text
DOM element
-> Smithable concept
-> source location
-> implementation index
```

Example:

```text
clicked button
-> action:createCustomer
-> page:customers
-> CustomerForm
-> relevant source/test/index entries
```

Production build must contain zero unnecessary Smithable editor instrumentation.

---

# 20. Editing classes

Separate edits into:

## Semantic changes

Examples:

- add field
- add model
- add relationship
- add page
- add permission
- add action

These MUST mutate the semantic model first.

## Presentation changes

Examples:

- spacing
- typography
- layout
- visual prominence

These may modify implementation-level presentation code or a future presentation metadata layer.

Do not pollute `smithable.yml` with arbitrary CSS details.

---

# 21. Deterministic operations

This is a core differentiator.

If a change can be implemented deterministically, do not use AI.

Examples:

```text
add model
add field
change field type
add relationship
create CRUD page
add navigation
create standard query
create standard action
change validation
change standard permission
generate migration
generate smoke test
create default form/table
```

Expose semantic operations through a stable API.

---

# 22. AI routing model

Use a tiered strategy.

```text
Tier 0:
rules/parser/deterministic operations

Tier 1:
small local Smithable model

Tier 2:
managed EU model

Tier 3:
user-configured stronger/frontier model
```

Never escalate automatically if deterministic tooling can perform the operation.

---

# 23. Local Smithable model

Design Smithable so a specialized small local model can be useful.

The local model does NOT need to be a world-class software engineer.

Primary tasks:

- natural language -> Smithable operation
- classify intent
- select relevant semantic concept
- summarize compiler errors
- map user phrasing to known fields/actions
- basic UI text
- basic presentation decisions
- simple constrained transformations

Example:

```text
"Customers need somewhere to enter their mobile number."
```

should become:

```json
{
  "operation": "addField",
  "model": "Customer",
  "field": {
    "name": "mobilePhone",
    "type": "phone"
  }
}
```

Smithable then performs the actual implementation deterministically.

---

# 24. Local model distribution

Initially use an existing small open model.

Do not train Smithable's own model before real usage data exists.

Support local inference via an OpenAI-compatible abstraction.

Potential runtimes:

```text
Ollama
llama.cpp
vLLM
other OpenAI-compatible servers
```

Eventually consider publishing:

```text
smithable/smithable-mini
```

on Hugging Face.

Possible long-term tiers:

```text
Smithable Mini
~1-3B
semantic intent parser

Smithable Local
~7-8B
semantic + lightweight assistance

Managed EU / frontier models
complex reasoning
```

Do not bundle multi-GB model weights directly into the main installer.

Offer optional model download/setup.

---

# 25. Training strategy for a future Smithable model

Smithable naturally produces useful training data.

Example:

```text
user request
+
current semantic context
+
correct Smithable operation
```

Store only when privacy/consent allows.

Prefer curated/synthetic/open training data for the public model.

Potential training dataset format:

```text
input:
"Only administrators should be allowed to delete orders."

context:
Order actions: createOrder, editOrder, deleteOrder

output:
setPermission(deleteOrder, admin)
```

The goal is NOT general coding.

The goal is semantic translation into Smithable operations.

---

# 26. AI provider abstraction

Do not hardcode Smithable to Mistral.

Support a provider interface.

Initial targets over time:

```text
local OpenAI-compatible endpoint
Mistral
Claude Code CLI
Anthropic API
other OpenAI-compatible APIs
```

Local/offline operation is a first-class mode.

---

# 27. Claude Code integration

Advanced users may optionally use locally installed Claude Code.

Smithable may invoke the local CLI in headless mode.

Smithable should:

- spawn the `claude` process
- consume structured/streaming output
- allow Claude to operate only inside appropriate project boundaries
- never copy/extract the user's Claude authentication credentials

This is an optional provider, not a core dependency.

---

# 28. Managed AI

Paid Smithable may provide managed inference.

Default managed option should preferably use an EU-hosted model/provider.

Example product behavior:

```text
Free/Open Source
- deterministic tooling
- local model
- BYO model
- BYO API

Paid subscription
- managed EU AI allowance
- support
- additional convenience/features

Smithable Cloud
- separate hosting cost
```

Avoid opaque proprietary "credits" where practical.

Prefer displaying actual included usage/value.

---

# 29. EU/private modes

Support explicit policies.

Example:

```text
AI policy:

Local Only
- deterministic
- local models
- no external inference

EU Only
- deterministic
- local
- approved EU-hosted inference only

Best Available
- allow configured external providers

Custom
- organization-defined allowlist
```

A company should be able to enforce:

```text
No source code leaves internal infrastructure.
```

---

# 30. WYSIWYG + semantic selection

The visual editor should understand semantic concepts, not just DOM nodes.

When the user selects a form field, Smithable should know:

```text
UI element
-> Customer.phone
-> Customer model
-> relevant page
-> relevant actions
-> implementation locations
-> tests
```

This allows:

```text
"Make this required"
```

to become:

```text
changeField(Customer.phone, required=true)
```

rather than sending source files to an LLM.

---

# 31. Token/context minimization

Never send an entire project to AI unless absolutely necessary.

AI tools should query the semantic index.

Examples:

```text
inspectModel(Customer)
inspectAction(createCustomer)
inspectPage(customers)
inspectSelectedElement()
findRelatedTests(Customer)
findImplementation(action:createCustomer)
```

Return narrow structured context.

Benchmark this later.

Possible public metric:

```text
"Add Customer phone field"

Smithable:
0 AI tokens

"Customers need somewhere to enter a phone number"

Smithable Local:
small local inference
0 cloud tokens

Traditional coding agent:
large repository context
```

---

# 32. AI change workflow

For requests requiring AI interpretation:

```text
User request
    |
    v
AI identifies semantic change
    |
    v
structured Smithable operation
    |
    v
validate
    |
    v
update smithable.yml
    |
    v
compiler / deterministic implementation
    |
    v
tests
    |
    v
preview
```

For genuinely custom behavior:

```text
semantic change
+
precisely scoped implementation context
+
AI-generated custom code
```

Avoid unrestricted repo-wide mutation where possible.

---

# 33. Drift detection

Because `smithable.yml` is authoritative, detect when manual source edits break declared functionality.

Example:

```text
smithable.yml declares:
action:createCustomer

index expects:
src/features/customers/actions.ts:createCustomer

actual:
symbol missing
```

Display:

```text
Implementation drift detected

[Repair]
[Inspect]
```

Repairs should be deterministic whenever possible.

---

# 34. Testing

Smithable should generate and maintain tests based on semantic definitions.

Automatically cover:

- declared pages render
- declared standard actions work
- permissions apply
- models validate
- migrations succeed
- health endpoint responds

Use Playwright for end-to-end smoke tests.

Custom business logic requires custom/additional tests.

---

# 35. Security

Security is built in.

Suggested tooling:

```text
secret scanning
dependency vulnerability scanning
SAST
container scanning
DAST
```

Candidate open-source tools may include:

- Semgrep CE
- Gitleaks
- Trivy
- OSV tooling
- OWASP ZAP

Security levels:

```text
Fast
typecheck/tests

Normal
+ dependencies
+ secrets
+ SAST

Release
+ container scan
+ DAST
```

AI may explain/remediate findings, but deterministic scanner output is authoritative.

---

# 36. Deployment contract

Every native app should produce an OCI image.

Runtime contract:

```text
listen on configured PORT
GET /health
configuration through env vars
logs to stdout/stderr
persistent state under /data
```

For SQLite apps:

```text
/data/database/app.db
/data/uploads/
/data/backups/
```

Everything irreplaceable should live under `/data`.

---

# 37. One-click deployment

Initial targets:

```text
Local Docker
Docker Compose export
```

Later:

```text
Smithable Cloud
other adapters/providers
```

One-click deployment should run release validation first.

---

# 38. Smithable Cloud

DO NOT build Smithable Cloud before the local product works well.

Smithable Cloud eventually may provide:

- application hosting
- managed AI
- TLS/domains
- persistent volumes
- backups
- deployment history
- logs
- rollback
- team accounts
- support
- enterprise integration

Smithable Cloud must consume standard Smithable OSS artifacts.

Open-source Smithable must never depend on Smithable Cloud.

---

# 39. Repository strategy

Start with ONE PRIVATE MONOREPO.

Recommended repository:

```text
smithable/
```

Only include code intended to be eligible for future open-source publication.

Do NOT put:

- billing
- customer data
- Smithable Cloud proprietary control plane
- internal operations secrets
- private commercial infrastructure

into the OSS repository.

Future:

```text
smithable/smithable
public OSS

smithable/smithable-cloud
private commercial services
```

Dependency rule:

```text
Smithable Cloud -> Smithable OSS

NEVER:

Smithable OSS -> Smithable Cloud
```

---

# 40. Monorepo structure

Suggested starting point:

```text
smithable/
  apps/
    desktop/
    studio/
    docs/

  packages/
    spec/
    ir/
    operations/
    compiler/
    adapter-api/
    adapter-tanstack/
    index/
    daemon/
    cli/
    vite-plugin/
    editor-runtime/
    agents/
    ai-providers/
    local-ai/
    security/
    deployment/
    shared-ui/

  templates/
    default/

  examples/
    todo/
    crm/
```

Do not over-fragment trivial packages.

Use pnpm workspaces initially.

Add heavier monorepo tooling only if useful.

---

# 41. Licensing boundary

Do not pick a final license casually before publication.

Goal:

- Smithable specification should be independently implementable
- local product should be truly open source
- generated apps must not inherit restrictive Smithable licensing
- commercial Smithable Cloud remains separate

Investigate a split such as:

```text
specification / SDK / runtime interfaces:
permissive license

Studio / daemon / compiler:
possibly AGPL or another OSI-approved license
```

Obtain legal advice before final public release.

The repository can remain private during early development.

---

# 42. Avoid premature cloud work

Do not spend early development time on:

- subscriptions
- billing
- customer management
- multi-region cloud
- Kubernetes
- enterprise SSO
- team collaboration
- sophisticated account systems

The local product is the proof.

---

# 43. First vertical slice

Build ONE full workflow before expanding.

Target application:

```text
Customer CRM
```

Start:

```text
Customer
- name
- email
```

Smithable should allow the user to:

1. create/open project
2. see `smithable.yml`
3. run generated application
4. open visual Studio
5. see Customers page
6. create/edit customers
7. visually select a field/component
8. type:

   "Customers should have a phone number."

9. local model or structured parser interprets:

```text
addField(Customer, phone, phone)
```

10. `smithable.yml` changes
11. deterministic compiler updates implementation
12. SQLite migration runs
13. form/table update
14. tests update/run
15. preview refreshes
16. implementation index updates
17. Git diff is visible
18. user can undo
19. security checks run
20. one-click build produces OCI image
21. one-click local deployment runs the container

The goal is that this workflow feels dramatically more controlled and efficient than a traditional AI code generator.

---

# 44. First benchmark

After the vertical slice works, test the same set of tasks using:

A. normal Claude Code against the generated repository

B. Smithable semantic operations/local model

Tasks:

```text
add phone to Customer
make email required
add Order relationship
add Orders page
restrict delete to admins
add Customer search
change navigation ordering
```

Measure:

- cloud AI tokens
- execution time
- number of files touched
- test success
- regressions
- human intervention

This benchmark should influence product direction.

---

# 45. Phase plan

## Phase 1 — Specification

Build:

- `smithable.yml` v0.1
- schema
- parser
- validation
- IR
- semantic operation API

No AI.

## Phase 2 — Native adapter

Implement:

- TanStack
- React
- Drizzle
- SQLite

Support:

- models
- fields
- relations
- standard CRUD
- basic pages
- navigation
- validation

## Phase 3 — Implementation index

Build generated semantic implementation graph/index.

Use SQLite internally.

Implement semantic queries.

## Phase 4 — CLI and daemon

Implement:

```text
smithable .
smithable validate
smithable generate
smithable run
```

## Phase 5 — Studio

Build basic Studio:

- app tree
- models
- pages
- preview
- logs
- manifest editor

## Phase 6 — Visual instrumentation

Add:

- hover
- selection
- semantic mapping
- source mapping
- toolbox

## Phase 7 — Deterministic WYSIWYG operations

Allow visual changes to invoke semantic operations.

No AI required.

## Phase 8 — Local AI

Integrate a small existing open model through OpenAI-compatible API.

Use it only for intent -> Smithable operation.

## Phase 9 — AI escalation

Add provider abstraction and stronger optional providers.

## Phase 10 — Verification/security

Add:

- Git snapshots
- tests
- Playwright
- security tools
- rollback

## Phase 11 — Container deployment

Add OCI build, local Docker and Compose export.

## Phase 12 — Desktop installer

Package Studio + daemon using Electron.

## Phase 13 — public OSS preparation

Only when the architecture is stable:

- documentation
- licensing
- contributor guide
- security policy
- CI
- secret scanning
- release process

## Phase 14 — Smithable Cloud

Only after the open-source/local product is compelling.

---

# 46. Architecture principles for Claude

While implementing Smithable, always follow these rules.

1. `smithable.yml` is authoritative for functionality.

2. `smithable.context.yml` controls implementation policy.

3. Implementation index is generated and disposable.

4. Smithable semantic operations are preferred over source-code mutation.

5. Deterministic implementation is preferred over AI.

6. Local AI is preferred over remote AI when sufficient.

7. EU-hosted inference is preferred for managed inference.

8. Framework-specific knowledge belongs in adapters.

9. The Smithable specification must remain framework-neutral.

10. Generated applications must remain ordinary maintainable software.

11. Generated applications must not require Smithable Cloud.

12. Keep generated/custom code DRY and concise.

13. Do not introduce abstractions before a concrete use requires them.

14. Do not generate unnecessary boilerplate.

15. Every significant change should be undoable.

16. Build and test incrementally.

17. Never silently resolve security findings by suppressing them.

18. No feature should require AI if deterministic tooling can perform it.

---

# 47. Product philosophy

Smithable should feel like:

```text
Rails
+
modern visual development
+
semantic application model
+
optional AI
+
local-first tooling
+
portable deployment
```

rather than:

```text
LLM
+
text editor
+
preview iframe
```

The most important conceptual difference is:

> Smithable understands the application.

Therefore:

> The AI does not have to rediscover the application on every request.

And:

> Most routine software-development operations should not require AI at all.

