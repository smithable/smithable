# Starters

A starter is a complete app to begin from: its spec, real sample records and pictures, and the generated code. Make one with `smithable new <folder> --starter <name>`, change it with operations or in your own words, or start it without the sample records with `--no-sample-data`. The pictures below are the starters as `smithable new` makes them, at desktop width.

## CRM

![The customers list of the CRM starter](starters/crm-1.webp)
![A customer's page in the CRM starter](starters/crm-2.webp)

For a sales team that keeps track of customers and their orders. It shows records that point at each other (an order's customer, a customer's orders), a formula that works out the shipping cost, a status for each order, an account manager who owns each customer, two roles with different rights, invitations to the team, and a custom action with its own code (merging two customers).

```sh
smithable new my-crm --starter crm
```

See it live: coming soon.

## Booking

![The landing page of the booking starter, Stillwater Yoga](starters/booking-1.webp)
![The class schedule a visitor sees](starters/booking-2.webp)

For a studio, a teacher or anyone who sells places in classes or sessions. Stillwater Yoga has a landing page with a cover picture, a gallery, a calculator ("would a monthly pass pay off?") and a contact form; a weekly class schedule that visitors can read; bookings with a capacity, so a full class takes no more; instructors with portraits; and a blog in Markdown.

```sh
smithable new my-studio --starter booking
```

See it live: coming soon.

## Invoicing

![The landing page of the invoicing starter, Invoicely](starters/invoicing-1.webp)
![An invoice in the invoicing starter](starters/invoicing-2.webp)

For a freelancer who sends invoices. Each user sees only their own clients and invoices; an invoice's lines work out their amounts and the invoice its total; the due date follows from the issue date; an overview page sums up what is owed; and a settings page holds the business details printed on every invoice.

```sh
smithable new my-invoices --starter invoicing
```

See it live: coming soon.

## Marketplace

![The catalog of the marketplace starter, Torget](starters/marketplace-1.webp)
![An item for sale, as a visitor sees it](starters/marketplace-2.webp)

For a place where people sell or give away things to each other. Torget's start page is the catalog, with search, filters (category, price, condition) and sorting; each item has several photos; members save the ones they like, keep a page of their own items, and send a seller a message from the item's page.

```sh
smithable new my-market --starter marketplace
```

See it live: coming soon.

## Records

![The landing page of the records starter](starters/records-1.webp)
![A record in the records starter](starters/records-2.webp)

The smallest starter: one kind of record and a public page that lists them. A good beginning for a collection, an inventory or anything you simply want to keep and show, and the quickest one to read if you want to see how a spec works.

```sh
smithable new my-collection --starter records
```

See it live: coming soon.

## Status page

![The public status page of the status starter, Northwind Status](starters/status-1.webp)
![An incident as the team edits it](starters/status-2.webp)

For a team that tells its users how its services are doing. Northwind Status shows each service's state on a public page with what is going on now, planned maintenance and recently resolved incidents; an incident moves through investigating, identified, monitoring and resolved, with a timeline of updates; and the incident history is public too. Uptime monitoring is not built in: the team opens the incidents.

```sh
smithable new my-status --starter status
```

See it live: coming soon.
