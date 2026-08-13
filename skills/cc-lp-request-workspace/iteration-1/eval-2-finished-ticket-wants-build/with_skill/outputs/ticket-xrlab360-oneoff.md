# XR Lab 360 — Create Landing Page (one-off 59.99 EUR, Apple Pay only)

Status: **not buildable as handed over.** Seven fields are missing and three of the supplied values
conflict with what is live in the panel today. Details in [Blocking](#blocking).

Everything below marked `TBC — <owner>` must be filled before the Card Create wizard is opened.
Nothing here should be inferred from a sibling page — see the conflict notes.

## Block A — applies to every slug in this request

| Field | Value |
| --- | --- |
| Product domain | `TBC — requester` (no domain in the ticket; Apple Pay identity and the page name both depend on it) |
| Target country | `TBC — requester` (all existing xrlab360 CC pages are `XX`) |
| `d_country` default | `TBC — requester` |
| Gateway | **CONFLICT — `celeris` in the ticket, `acquired` everywhere else.** See B1. `TBC — requester / billing` |
| Bank name | `TBC — billing team` (required as a token in the page name) |
| Bank ID | **CONFLICT — `42` in the ticket; every live xrlab360 page uses `8`.** See B2. `TBC — billing team` |
| MCC / legal entity | `TBC — requester` (live xrlab360 pages split between `PEPPEROSE LIMITED` id 11 and `Prizeflix B.V.` id 4) |
| Service ID | `xrlab360` |
| Service display name | `XR Lab 360` (matches every live page) |
| Page title | `TBC — requester` (live pages differ: "XR Lab 360 — Try it now", "Intellect VR") |
| Apple Pay merchant identifier | `TBC — Apple developer account owner`. **Do not inherit** — see B3 |
| Apple Pay label | `TBC — Apple developer account owner` (should be the serving domain; live pages carry `""` and `"now"`) |
| Supported card networks | `visa, masterCard, maestro` (assumed from live xrlab360 pages — confirm) |
| Google Pay enabled? | **No** — stated explicitly in the ticket. See note B7 |
| Card Submit enabled? | `TBC — requester`. "Apple Pay only" reads as "no card form", but say it in the panel's own terms |
| Template / git repo | **CONFLICT — `cc-dynamic-xrlab360-template-gcomp` v3 does not exist.** See B4 |
| New build expected? | `TBC — requester` (depends on which template resolves in B4) |
| Creative | `TBC — requester` (every live xrlab360 page is `download`) |
| Publish after creating? | `TBC — requester` |
| Existing pages to reuse or retire | **12 live xrlab360 CC pages already exist, 9 of them on this exact slug.** See B5 |

## Block B — one row per billing slug

| Page name | Slug (no country) | Plan type | Price | Trial price | Trial days | Billing cycle | Currency | Local currency? | Force comp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `xx-cc-<bank>-xrlab360-applepay-<gateway>-download-oneoff-gcomp-dyn` | `cc_acquired-xrlab360portal5999_000-` | `one-off` | `59.99` | `59.99` | `0` | `0` | `EUR` | `no` (assumed) | `no` (assumed) |

Notes on that row:

- **Slug is well-formed.** Ends at the trailing hyphen, no country suffix. Nothing to fix.
- **Trial price is deliberately 59.99, not blank.** The panel hides the Trial Price input for a
  one-off plan but still saves whatever it held — `0.01` by default — and the page reads that value
  as the charge amount. Leaving it alone turns a €59.99 charge into one cent.
- **Page name has two unresolved tokens** (`<bank>`, `<gateway>`). Page names are globally unique, so
  it can't be created until B1 and B2 are settled.

## Blocking

- **B1 — Gateway: `celeris` or `acquired`?** — requester / billing. The ticket says `celeris`, but
  the slug is prefixed `cc_acquired-` and all 12 live xrlab360 pages carry `"gateway": "acquired"`.
  One panel page mixes them (`xx-cc-xr-vreducationlab-xrlab360-applepay-acquired-tst-gcomp-dyn`,
  gateway `celeris` on an `cc_acquired-…` test slug) and it is a test page. This is not resolvable
  from the outside — a wrong gateway routes real money to the wrong acquirer.
- **B2 — Bank ID 42 has no bank name, and 42 appears nowhere in the panel** — billing team. Every
  live xrlab360 page uses bank ID `8`; the only other ID in use across the whole result set is `7`.
  Either 42 is a newly provisioned bank (then we need its name for the page name) or it is a
  transcription error.
- **B3 — Apple Pay merchant identifier and label for the serving domain** — Apple developer account
  owner. There is no correct value to copy: production currently holds
  `merchant.com.xracademy.online.2` (borrowed from a different product's domain) and
  `merchant.com.xrlab360.portal..acquired` (malformed — double dot). Apple validates the identifier
  against the serving domain during merchant validation, so either one can fail live Apple Pay
  sessions. On an Apple-Pay-only page that is the entire funnel.
- **B4 — Template `cc-dynamic-xrlab360-template-gcomp` v3 does not exist** — requester / builder.
  The only xrlab360 template in use is `cc-dynamic-xrlab360-template-download-nid-gcomp`, currently
  at **v5**. Either the ticket means that template (and v3 is a stale version reference), or a new
  repo/template has to be created and uploaded first.
- **B5 — Product domain, target country and `d_country` default** — requester. None are in the
  ticket. The domain drives the Apple Pay identity (B3) and the page name.
- **B6 — MCC / legal entity** — requester. `PEPPEROSE LIMITED` (id 11) on the newest xrlab360 page,
  `Prizeflix B.V.` (id 4) on the older ones. Guessing puts the wrong company on the billing legals.
- **B7 — Existing pages: reuse, replace or retire?** — requester. Nine live pages already share the
  slug `cc_acquired-xrlab360portal5999_000-`, all of them **trial-then-subscription at €49.99 / 28
  days**, not one-offs. Worth confirming with billing that this slug is being repurposed to a €59.99
  one-off rather than a tenth page being stacked on it.

## Non-blocking, but confirm

- **Google Pay is correctly declared off**, and that matters — but note the panel writes a
  `payments.googlePay` block into the saved config even with the checkbox cleared. Verified live:
  page `xx-cc-xr-intellectvr-xrlab360-applepay-acquired-download-gcomp-dyn` is Apple-Pay-only by
  name yet still carries a full googlePay block with a real `gatewayMerchantId`. Page code that
  gates on "does the block exist" will render a Google Pay button. Add an explicit post-create check.
- **Card Submit** is not stated. "Apple Pay only" probably means it's off, but state it as a
  checkbox value rather than an inference.
- **Local currency** — live xrlab360 pages run both ways (`-lc-` variants exist). Assumed `no`
  because the ticket fixes the price in EUR.
- **Price sanity** — the slug encodes `5999`, consistent with €59.99. Good.

## Filled in by the builder

| Slug | Live page | Panel edit link |
| --- | --- | --- |
| `cc_acquired-xrlab360portal5999_000-` | | |
