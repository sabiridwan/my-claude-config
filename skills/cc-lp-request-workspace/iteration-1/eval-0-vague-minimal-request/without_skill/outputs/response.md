Ticket drafted — `outputs/ticket-docpilotai-lp.md`, ready to paste into the CC board. I didn't post
it to Notion or touch the panel; both are yours to trigger.

The main thing to know before you read it: **DocPilot AI already has a template, a repo and two
pages.** This is a variant, not a new product.

- Template `cc-dynamic-docpilotai-template-gcomp` (id 154, v15), repo checked out locally on `master`.
- Page **830 / `x8hhi`** — 0.01/1d → 49.99/28d, Apple + Google Pay
- Page **840 / `xh5nq`** — 0.00/1d → 49.99/28d, Apple + Google Pay

So your ask is those pages with three deltas: 49.99 → 29.99, Google Pay off, new slug.

**But you can't just clone 830.** Both existing pages carry:

1. `slug: "cc_acquired-xrlab360portal5999_000-"` — an **xrlab360** slug at a 59.99 token, on a 49.99
   DocPilot page.
2. `applePay.merchantIdentifier: "merchant.com.xracademy.online.2"` — **xracademy's** identifier.
   Apple validates that against the serving domain, so Apple Pay can't complete merchant validation
   on docpilotai.com. On an Apple-Pay-only page that's not a degradation, it's a page that takes
   zero payments.
3. The gateway is named three different ways inside one config — `celeris` at top level,
   `celerispay` under Google Pay, `acquired` inside the slug — with `bankId: 8`, which doesn't match
   the `173` we used for celeris on CC-377.

**Two hard blockers I can't resolve from anything readable:**

- **Gateway + bank ID.** Given the above, nothing in the existing config is trustworthy by copy.
  Needs stating explicitly by whoever owns the MID.
- **An Apple Pay merchant identifier for docpilotai.com.** Related: the Pepperose wallet merchant
  IDs were still outstanding on the smartpdfdesk/PXP work as of yesterday, and Pepperose is the same
  MCC here (id 11 — confirmed, it matches docpilotai.com's own footer).

**And three things your one-liner didn't settle**, all of which change the copy, not just the config:

- **Is there a trial?** Every sibling page is 1 day at 0.01 or 0.00 into a 28-day sub. A straight
  no-trial 29.99 is equally plausible. Changes slug, plan type, order-summary copy and the legal
  price line.
- **"A month" — 28 or 30 days?** House standard is 28 and the copy renders literally as "per 28
  days". If marketing means a calendar month, both need to say 30.
- **Card Submit off too?** "Apple Pay only" read literally means no card form at all. Just flagging
  it, since it caps conversion hard.

I've assumed 0.01/1d → 29.99/28d, EUR, `d_country=de`, card submit off, leave unpublished — all
marked `⚠ CONFIRM` in the ticket so nothing gets typed into the panel on my say-so.

One more, unrelated to your ask but you should see it: pages 830 and 840 are live-ish and billing
against an xrlab360 slug. Worth deciding whether they get fixed or retired.
