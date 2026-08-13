---
name: cc-lp-request
description: Turn a request for a credit-card landing page into a complete, buildable ticket. Interviews the requester for every field the Ouisys Card Create wizard needs, flags the values that are commonly wrong or missing, and outputs a paste-ready ticket table. Use this whenever someone says they need a landing page, LP, or checkout page for a credit-card product, wants to "request a page", is filling in a CC Tasks ticket, is adding new billing slugs or MIDs to an existing product, or asks what information a landing-page request needs — even if they only name a product and a price and assume the rest is obvious. This is the REQUESTER side; it produces a ticket, never a page. Building the page from a finished ticket is cc-dynamic-lp and cc-ouisys-panel.
---

# Requesting a credit-card landing page

Your job is to end up with a ticket someone can build from without asking a single follow-up
question. Not to build the page.

A credit-card landing page is assembled from about thirty values, and the builder cannot invent any
of them — every one is either a legal identity, a merchant credential, or a price that will be
charged to real cards. When a field is missing, the builder either blocks and asks (a day lost) or
guesses from a similar page (worse — wrong merchant identifiers and wrong slugs have shipped to
production that way).

So the value you add is **completeness and precision**, not speed. A request that looks finished but
omits the Apple Pay merchant identifier is worse than one that openly marks it as TBC, because the
first one gets silently filled in from another product's page.

## Ask for six things, derive the rest

The ticket has about thirty fields, but a requester should never be asked thirty questions. Most
values are constant per product or already sitting in the panel — asking for them is busywork that
makes people avoid filing properly. Only six things are genuinely unknowable from outside the
requester's head:

1. Product + domain
2. Slugs, one per line, with price and one-off / trial
3. Gateway + bank (name and ID)
4. Apple Pay merchant identifier + label
5. Google Pay on? Card form on?
6. Anything different from the last page for this product?

`assets/quick-request.md` is this list as a paste-able form, with a worked example — hand it to
anyone who asks what you need.

Everything else you find yourself: existing pages for the product, MCC, template and its versions,
service id and display name, and what sibling pages use for networks and bank ID all come from the
panel and the repos. Do that lookup *before* asking anything, so your questions are only about the
genuine gaps.

When you fill a field yourself, say where it came from ("MCC Prizeflix B.V. — matches the other
pages on this domain"). A derived value the requester can correct in one glance is useful; a derived
value presented as fact is how another product's merchant identifier ends up in production.

## How to run this

1. **Collect what they already have.** They usually arrive with a product name, some prices, and a
   domain. Take it all, then work out what's missing rather than making them recite fields they've
   already given you.
2. **Look it up before asking.** Pull the product's existing pages and template from the panel, then
   interview only for what's left, using `references/field-reference.md` as the checklist. Ask in
   batches grouped by theme, not one question at a time — people answer "what's the gateway, bank
   name and bank ID?" in one go.
3. **Challenge the values that are usually wrong.** See "Values to interrogate" below. This is where
   the skill earns its keep.
4. **Produce the ticket** using `assets/ticket-template.md`. Fill every cell you have; mark the rest
   `TBC — <who owns it>` so it's obvious what's blocking and who unblocks it.
5. **Tell them what is still blocking**, in one short list at the end, and who needs to supply each
   item.

If they push back on a question — "just use whatever the other page uses" — explain the specific
consequence rather than insisting. Apple Pay merchant identifiers, for instance, are validated
against the serving domain, so borrowing one from a sibling product can fail live payment sessions.
People are reasonable when they understand the failure mode.

## Values to interrogate

These are the fields that have actually shipped wrong. Ask about them directly even when the
requester seems confident.

**Slug — must not end with a country code.** The slug ends at the trailing hyphen:
`cc_celerispay-docxhelp2999_001-`. The page appends the country itself at runtime — the template
does `slug = ${slug}${country.toLowerCase()}` with the country read from the `d_country` URL
parameter — so a slug supplied as `…_001-de` bills against `…_001-dede`. The trailing hyphen is
structural, not decoration: the local-currency branch one line above builds
`${slug.slice(0, -1)}:${currency}-${country}` and relies on it being there to slice off.

Requesters copy slugs out of billing systems where the country *is* part of the displayed
reference, so this is the single most common defect in a request. Check it every time, and confirm
what `d_country` should default to while you're there.

**Gateway — name it, don't imply it.** A ticket titled after one gateway while every slug names
another is ambiguous and the builder cannot resolve it. Get the gateway as an explicit value
(`celeris`, `maxpay`, `acquired`, `aci-pxp`).

**Apple Pay identity — per domain, never inherited.** The merchant identifier
(`merchant.com.<something>.N`) and the sheet label both belong to the domain being served. If the
requester doesn't have them, that's a real blocker owned by whoever manages the Apple developer
account — mark it TBC rather than letting the builder copy a neighbouring product's.

**Plan type — in the panel's own words.** `subscription`, `trial-then-subscription`, or `one-off`.
"One off: yes/no" plus a sentence of prose is ambiguous, and the three shapes produce different
billing copy on the page. A one-off charges once and never renews; describing it as a subscription
makes the page advertise a renewal that will never happen, which is a compliance problem rather than
a wording preference.

**One-off price needs stating twice.** For a one-off, the charge amount belongs in *both* the price
and trial-price fields. The panel hides its Trial Price input for one-off plans but still saves
whatever was there — defaulting to `0.01` — and the landing page reads that value for the charge
amount. An unstated one-off price silently becomes one cent.

**Google Pay off is not the same as absent.** If the product has no Google Pay, say so explicitly.
The panel still writes a `googlePay` block into the saved config even when the checkbox is cleared,
so "it's not in the ticket" reads as "nobody mentioned it" rather than "it's disabled".

**Bank name as well as bank ID.** The numeric bank ID goes in the config; the bank *name* is a token
in the page name. A ticket carrying only `173` cannot produce a correctly-named page.

**Existing pages for the same product.** Ask whether a page already exists and whether it should be
reused, replaced, or retired. Page names are globally unique, and a forgotten older page tends to
linger with stale config, ready to confuse whoever finds it next.

## Producing the ticket

Use `assets/ticket-template.md`. It has two parts, and the split matters: **Block A** is the values
shared by everything in the request, **Block B** is one row per billing slug. Most requests carry
several slugs for one product — same domain, same merchant identity, different prices — so repeating
Block A per slug creates noise and invites inconsistency.

Fill it out, then read it back as if you were the builder. Any cell you'd have to ask about is a
cell that isn't finished.

Close with the blockers list. Keep it short and name the owner:

```
Blocking:
- Apple Pay merchant identifier for vreducationlab.com — Apple developer account owner
- Bank name for bank ID 173 — billing team
```

## Filing it into Notion

The ticket's home is the **CC Tasks** board. If a Notion MCP server is connected, offer to file it
directly rather than making the requester paste it — read `references/notion-filing.md` for the data
source id, the exact properties to set, and the ones that are system-managed or booby-trapped
(there is a `Description (don't use)` property that means what it says).

One rule that matters more than the mechanics: **draft the ticket in the conversation, show it, and
only create the page once the requester has said yes.** Filing is visible to the whole team and
notifies watchers, and a half-complete ticket under a real CC number reads to a builder as though
the gaps were considered and deliberately left — which is exactly the failure this skill exists to
prevent. Hold it until they have seen the blockers list.

If no Notion MCP is connected, hand back the markdown and say plainly that it wasn't filed.

## What this skill does not do

It doesn't create the page, touch panel.ouisys.com, or scaffold a repo. If the person you're helping
turns out to be the builder rather than the requester — they have a finished ticket and want the
page made — that's `cc-dynamic-lp` (build and upload) and `cc-ouisys-panel` (create the page in the
panel). Say so and hand off rather than half-doing both jobs.

## Reference

`references/field-reference.md` — every field, its example value, the panel control it maps to, and
the `pageConfigs` key it ends up in. Read it when interviewing so you can tell the requester exactly
where a value lands and why it matters. It also carries the failure story behind each trap above, if
someone wants the detail.
