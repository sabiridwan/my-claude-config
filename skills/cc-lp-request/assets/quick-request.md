# Quick request — 6 lines

Paste this, fill what you know, send it. Anything you leave blank gets looked up or marked as a
blocker with an owner — nothing gets silently guessed.

```
1. Product / bank, and how many MIDs:
2. Per MID — name or link, descriptor domain, slug, price, one-off / trial:
3. Gateway + bank (name and ID), per MID if they differ:
4. Apple Pay merchant identifier + label, per MID:
5. Google Pay on? Card form on?
6. Anything different from the last page for this product?
```

You get recorded as the requester — the person the ticket goes back to when something is blocking.
If you're sending this on someone else's behalf, say whose request it is.

**If the request covers several MIDs, that's several pages** — one per MID. Link the MID pages if
they exist and lines 3 and 4 mostly fill themselves; each MID page carries its descriptor domain,
bank, gateway, entity and MCC. The two things no lookup can supply are the **slug and the price
point per MID**, which is why line 2 asks for them together.

## What each line is for

**1. Product + domain** — everything else keys off this. With it alone the existing pages, MCC,
template, service id and display name can be pulled from the panel.

**2. Slugs, prices, plan shape** — the only genuinely per-page values. Paste slugs exactly as your
billing system shows them; the country suffix gets stripped for you rather than you having to
remember. Say *one-off* or *trial* per line — that word decides the billing copy on the page, and
guessing it wrong means advertising a renewal that never happens.

**3. Gateway + bank** — the gateway can be inferred from the slug prefix but never assumed, and the
bank *name* is a token in the page name that no lookup can supply. "Same as <existing page>" is a
valid answer.

**4. Apple Pay identity** — the one field that cannot be derived, borrowed, or inferred. It's tied
to the domain being served, so another product's identifier means live payments fail. Leave it blank
if you don't have it and it becomes a named blocker.

**5. Wallets** — "Apple Pay only" is a decision worth stating rather than implying, because a
config with no Google Pay block and a config with Google Pay switched off look different to the
page code.

**6. Deltas** — template, creative, country, currency, publish-or-not. Usually "same as last time",
which is a complete answer.

## Example of a filled one

```
1. smartpdfdesk / smartpdfdesk.com
2. cc_acquired-smartpdfdesk2999_001-de  29.99  one-off
   cc_acquired-smartpdfdesk1999_002-de  19.99  one-off
3. acquired, bank 8 (name TBC)
4. don't have it yet
5. apple pay + google pay, no card form
6. same as last time
```

That's enough to produce a full ticket. The slugs get their `-de` stripped, the one-off prices get
written into both price fields, the MCC and template come from the panel, and two blockers come back
named: the bank name and the Apple Pay merchant identifier.
