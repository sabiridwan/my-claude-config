Ticket drafted — it's in `ticket.md`, ready to paste into CC Tasks.

Heads up before you send it: a CC landing page is assembled from about thirty values, and what you gave me covers four of them. I've filled in everything I could safely derive and marked the rest `TBC — <owner>` rather than leaving blanks, because a blank cell tends to get filled in by copying from another product's page, and that's how wrong merchant identifiers and wrong slugs have shipped to production.

**What I assumed** (correct any of these and I'll update the ticket):

- Service ID `docpilotai`, display name and title `DocPilot AI`, Apple Pay label `docpilotai.com`
- Plan type `subscription` with no trial — if there's a trial, that changes to `trial-then-subscription` and needs its own price and day count
- Currency `USD`, read off the dollar sign
- "Apple Pay only" = Google Pay **off** and Card Submit **off**, both stated explicitly in the ticket so nobody reads the omission as "nobody mentioned it"
- New repo `cc-dynamic-docpilotai-template-gcomp`, new build

**Three things I'd want answered even before the blockers:**

1. **"A month" isn't a value the panel takes** — it wants days. Our default on these pages is 28, which bills 13 times a year, not 12. If you mean genuinely monthly it's 30 and the page can say "per month"; if it's 28 the copy has to say "every 28 days". Your call, but it has to be one or the other.
2. **Apple Pay only leaves no fallback.** Anyone without an Apple Pay–capable device or browser can't convert at all. Fine if that's deliberate — just confirming it's a decision and not shorthand.
3. **The Apple Pay merchant identifier is a hard blocker here.** Apple validates it against the serving domain, so one borrowed from a sibling product can fail live payment sessions. On an Apple-Pay-only page that means zero payments. It has to be issued for docpilotai.com by whoever owns the Apple developer account.

**Still blocking, with owners:**

- Target country + `d_country`, currency, billing cycle, creative, publish-or-not, and confirmation no docpilotai page already exists — **you**
- Gateway, bank name + bank ID, the billing slug, supported card networks — **billing team**
- MCC / legal entity — **billing / compliance**
- Apple Pay merchant identifier for docpilotai.com — **Apple developer account owner**

One note for whoever fills in the slug: it ends at the trailing hyphen, e.g. `cc_<gateway>-docpilotai2999_001-`, with no country on the end. Billing systems show the country as part of the reference so it gets pasted in in good faith, but the page appends it again at runtime from `d_country` and you end up with a doubled country and a broken billing reference.

Send me the answers in one batch and I'll finish the ticket. Building the page from it is a separate job (`cc-dynamic-lp` for the repo and upload, `cc-ouisys-panel` for creating it in the panel) — this is just the request.
