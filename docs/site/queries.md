# Lists a filter cannot make

A list page's filters choose records by their values: open orders, this week's classes. Some lists need a judgment a filter cannot say, such as the customers most likely to stop buying, most at risk first. A **query** is such a list, chosen or ordered by code of your own.

```yaml
queries:
  churnRisk:
    custom: true
    returns: Customer[]
    intent: Customers most likely to stop buying, most at risk first.
    rules:
      - A customer without an order in 90 days is at risk.
```

- **`returns`** is the kind of record it lists.
- **`intent`** and **`rules`** say what it is for, in words: for you, for a model that writes its code, and for whoever reads it later.

## Its code

Smithable makes `src/custom/queries/churn-risk.ts` **once**, as a first version that returns every record the viewer may read. From then on the file is yours, and Smithable never writes over it ([your own code](code.md)). The code starts from the app's data functions, which apply the access rules, so a query never shows anyone a record they may not read.

To have a model write the code from the intent and the rules:

```console
$ smithable code query:churnRisk "customers without an order in 90 days, longest first"
```

Only files in `src/custom/` may change, and the change is kept only when the type check and the tests pass ([AI setup](../ai.md)).

## Showing it

A dashboard shows a query's records in a tile:

```yaml
pages:
  home:
    dashboard:
      atRisk: { query: churnRisk, limit: 5 }
```

## From the command line

```console
$ smithable op addQuery churnRisk Customer
```

adds the query, after which its code is written as above. The [spec reference](../spec/v0.1.md#queries) has every rule.
