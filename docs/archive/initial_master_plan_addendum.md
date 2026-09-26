# Smithable Master Plan Addendum

## Semantic free-text as an escape hatch

Smithable must not force every application concept into a rigid DSL.

The manifest should remain compact and high-level.

Use structured metadata wherever a concept can be represented reliably, but allow carefully scoped free-text fields wherever application meaning, intent or business behavior cannot be expressed cleanly through the formal schema.

The design principle is:

> Structure where structure is useful. Natural language where semantics are nuanced. Code only where actual programming is required.

---

# 1. Separate semantic intent from implementation guidance

Free text belongs in two different layers.

## `smithable.yml`

Contains application meaning.

Examples:

- what a page is for
- what an action is intended to accomplish
- important business rules
- domain meaning
- examples and edge cases
- user-facing behavior

This answers:

> WHAT should the application do, and WHY?

## `smithable.context.yml`

Contains implementation guidance.

Examples:

- UI style preferences
- coding conventions
- architectural preferences
- dependency policies
- performance preferences
- test expectations
- implementation-specific instructions

This answers:

> HOW should Smithable implement it?

Do not mix these concerns.

---

# 2. Recommended semantic text fields

Do not use one generic `notes` field everywhere.

Prefer a small vocabulary with defined meaning.

Suggested fields:

```text
description
intent
rules
examples
```

## `description`

Describes what something represents.

Example:

```yaml
models:
  Customer:
    description: >
      A company or organization with which we have a commercial relationship.
```

## `intent`

Describes the desired outcome or user experience.

Example:

```yaml
pages:
  dashboard:
    intent: >
      Give salespeople a rapid overview of customers requiring attention today.
```

## `rules`

Defines important domain constraints that are awkward or premature to encode in the formal DSL.

Example:

```yaml
actions:
  calculateCreditRisk:
    rules:
      - Recent failed payments should substantially increase risk.
      - Long-term customers with consistent payment history should generally have lower risk.
```

## `examples`

Provides concrete examples and expected behavior.

Example:

```yaml
actions:
  determineInvoiceDueDate:
    examples:
      - input:
          customerType: government
          invoiceDate: 2026-09-01
        expected:
          dueDate: 2026-10-16
```

These examples may later be used to generate tests.

---

# 3. Free text should be scoped

Do not maintain a giant application-wide natural-language blob if the information belongs to one specific concept.

Prefer:

```yaml
pages:
  dashboard:
    intent: ...
```

over:

```yaml
app:
  notes: >
    The dashboard should...
```

Likewise, attach business rules to the action, field, model or page that owns them.

This makes context retrieval much smaller and more precise.

---

# 4. AI context construction

When Smithable invokes an AI model, it should construct the smallest useful semantic context.

Do not automatically send:

- entire `smithable.yml`
- entire `smithable.context.yml`
- entire repository
- entire implementation index

Instead retrieve only the relevant semantic slice.

Example user request:

> Make the dashboard prioritize customers most likely to churn.

Possible model context:

```yaml
request: >
  Make the dashboard prioritize customers most likely to churn.

page:
  id: dashboard
  intent: >
    Give salespeople a rapid overview of customers requiring attention today.

model:
  Customer:
    description: >
      A company or organization with which we have a commercial relationship.

    fields:
      - lastOrderDate
      - lastContactDate
      - outstandingBalance
      - orderCount

availableOperations:
  - addQuery
  - modifyPage
  - addComputedField
```

This should normally be enough for interpretation without repository-wide context.

---

# 5. Escalation must preserve compact context

Use the same semantic context across model tiers.

Conceptual flow:

```text
User request
    |
    v
deterministic parser/rules
    |
    v
small local model
    |
    | confidence insufficient
    v
managed EU model
    |
    | still requires implementation reasoning
    v
frontier/custom model
```

Each tier should receive:

- user intent
- relevant semantic objects
- relevant free-text descriptions/rules/examples
- available Smithable operations
- only the implementation slice required at that tier

Do not escalate by dumping more unrelated project data.

---

# 6. Confidence-aware local model usage

The local model should be encouraged to return structured output plus confidence or ambiguity information.

Example:

```json
{
  "operation": "addField",
  "model": "Customer",
  "field": {
    "name": "mobilePhone",
    "type": "phone"
  },
  "confidence": 0.96
}
```

If confidence is low or multiple interpretations are plausible, Smithable may:

- ask the user
- retrieve more semantic context
- escalate to a stronger model

Do not allow low-confidence local inference to silently mutate the application.

---

# 7. Natural language is not the source of implementation truth

Free-text fields describe semantics, not implementation state.

For example:

```yaml
actions:
  calculateCreditRisk:
    intent: >
      Produce a score indicating the likelihood of credit problems.
```

does not imply that an implementation exists.

The generated implementation index remains responsible for tracking:

```text
semantic concept
-> implementation
-> tests
-> source symbols
```

---

# 8. Convert stable semantics into structure over time

If the same type of free-text rule appears repeatedly and proves to be broadly useful, consider promoting it into the formal Smithable schema.

Example evolution:

Initially:

```yaml
rules:
  - Only administrators may delete customers.
```

Later, once permissions are formalized:

```yaml
actions:
  deleteCustomer:
    permission: admin
```

Use free text as an escape hatch, but do not leave universally useful concepts informal forever.

---

# 9. Avoid premature schema expansion

Do not add a new structured DSL construct merely because one application needs it.

Before extending the schema, ask:

1. Is this concept common across many applications?
2. Can it be implemented deterministically?
3. Does formalizing it reduce AI usage or ambiguity?
4. Can it remain technology-independent?
5. Is it materially better than scoped free text plus custom code?

If not, keep it as semantic text or custom implementation.

---

# 10. Free text can assist deterministic generation

Natural language does not necessarily mean the resulting implementation must be AI-generated.

Example:

```yaml
pages:
  customers:
    intent: >
      Show customers in a compact business-oriented table.
      Users should be able to find a customer quickly.
```

A local model may interpret that as:

```text
useStandardTable(Customer)
enableSearch(Customer)
density=compact
```

Smithable then performs those operations deterministically.

Thus:

```text
free text
    |
    v
small model interprets
    |
    v
structured Smithable operations
    |
    v
deterministic implementation
```

This is preferable to allowing the model to directly rewrite arbitrary React code.

---

# 11. Examples should be first-class

Where practical, examples in the manifest should be machine-readable rather than prose-only.

Example:

```yaml
actions:
  calculateShipping:
    intent: >
      Calculate shipping cost.

    rules:
      - Orders above 100 EUR have free standard shipping.

    examples:
      - input:
          total: 150
          shippingMethod: standard
        expected:
          shippingCost: 0
```

Potential uses:

- AI context
- generated tests
- regression validation
- documentation
- user-visible examples
- fine-tuning data for future Smithable models

---

# 12. Semantic text should participate in the implementation index

The implementation index should know which implementation elements correspond to semantic concepts containing free-text intent.

Example:

```text
page:dashboard
  intent:
    "Give salespeople a rapid overview..."

  implementation:
    DashboardPage
    AttentionQuery
    CustomerAttentionCard
```

This allows Smithable to retrieve:

```text
semantic intent
+
implementation slice
```

when a model genuinely needs source-level reasoning.

---

# 13. Future local-model training

The combination of structured state, free-text intent and accepted semantic operations creates a strong training format.

Example training item:

```yaml
request: >
  Customers need somewhere to enter their mobile number.

context:
  model:
    Customer:
      fields:
        name: string
        email: email

output:
  operation: addField
  model: Customer
  field:
    name: mobilePhone
    type: phone
```

Another:

```yaml
request: >
  Only administrators should be able to remove orders.

context:
  action: deleteOrder

output:
  operation: setPermission
  target: deleteOrder
  permission: admin
```

This is a substantially narrower problem than general software engineering and may eventually support a small specialized Smithable model.

---

# 14. Context-size principle

Treat context size as a product metric.

For every AI-assisted operation, Smithable should be able to record:

```text
semantic context tokens
implementation context tokens
model used
operation type
whether escalation occurred
```

This can eventually support:

- optimization
- benchmarking
- debugging
- product claims about reduced token use

Avoid collecting actual private project content for analytics unless explicitly permitted.

---

# 15. Final architectural model

The updated Smithable information hierarchy should be:

```text
1. smithable.yml

   Structured application semantics
   +
   scoped natural-language intent/rules/examples

                 |
                 v

2. smithable.context.yml

   Implementation technology
   conventions
   structured AI/project guidance
   optional free-text implementation guidance

                 |
                 v

3. Smithable IR

   Technology-independent normalized model

                 |
                 v

4. .smithable/index.db

   Generated mapping between semantics and implementation

                 |
                 v

5. Application code

   Normal framework/application code
```

AI should normally interact with layers 1–4 through semantic tools rather than reading layer 5 wholesale.

---

# 16. Updated product principle

Smithable should not require users to choose between:

> rigid low-code metadata

and

> unrestricted AI-generated source code.

Instead use:

```text
formal metadata
      +
semantic natural language
      +
custom code
```

with each used where it is strongest.

The hierarchy should be:

```text
Can this be expressed structurally?
    -> use Smithable metadata

Does it require interpretation but map to known operations?
    -> use local AI to interpret it

Is the behavior genuinely custom?
    -> use scoped custom code / stronger AI if needed
```

This principle should guide future schema and AI design.

