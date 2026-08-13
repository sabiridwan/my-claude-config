# DocPilot AI — Create Landing Page

Requested: docpilotai.com, $29.99/month, Apple Pay only.

Anything marked `TBC — <owner>` is not yet answerable and is listed again under **Blocking**.
Anything marked `ASSUMED` is my inference from the request, not something the requester stated —
correct it or confirm it before the builder starts. **Do not let the builder fill a TBC cell by
copying from a neighbouring product's page.**

## Block A — applies to every slug in this request

| Field | Value |
| --- | --- |
| Product domain | `docpilotai.com` |
| Target country | TBC — requester |
| `d_country` default | TBC — requester (lowercase form of target country, e.g. `us`) |
| Gateway | TBC — billing team (must be one of `celeris` / `maxpay` / `acquired` / `aci-pxp`) |
| Bank name | TBC — billing team |
| Bank ID | TBC — billing team |
| MCC / legal entity | TBC — billing / compliance |
| Service ID | `docpilotai` — ASSUMED from domain |
| Service display name | `DocPilot AI` — ASSUMED (confirm exact casing/spacing as it should appear on the page) |
| Page title | `DocPilot AI` — ASSUMED, same as display name |
| Apple Pay merchant identifier | TBC — Apple developer account owner. Must be issued for `docpilotai.com`; shape is `merchant.com.docpilotai.N`. Do not inherit one from another product. |
| Apple Pay label | `docpilotai.com` — ASSUMED (label is the serving domain) |
| Supported card networks | TBC — billing team / acquirer (e.g. `masterCard, maestro`, and whether `visa` is included) |
| Google Pay enabled? | **No** — explicitly disabled. "Apple Pay only" per requester. |
| Card Submit enabled? | **No** — explicitly disabled. "Apple Pay only" per requester. See flag 4 below. |
| Template / git repo | `cc-dynamic-docpilotai-template-gcomp` — ASSUMED naming; confirm the repo is created |
| New build expected? | Yes — ASSUMED (new product, no existing repo known) |
| Creative | TBC — requester (`download` / `video` / comp-only) |
| Publish after creating? | TBC — requester (`publish` / `leave unpublished`) |
| Existing pages to reuse or retire | TBC — requester. Assumed none, but page names are globally unique — confirm nothing exists for docpilotai before creating. |

## Block B — one row per billing slug

Only one price was given, so this is a single-slug request. Add a row per slug if more prices/markets
are in scope.

| Page name | Slug (no country) | Plan type | Price | Trial price | Trial days | Billing cycle | Currency | Local currency? | Force comp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<cc>-cc-<bank>-docpilotai-<product>-applepay-<gateway>-<creative>-sub-gcomp-dyn` — TBC, resolves once country/bank/gateway/creative land | TBC — billing team. Expected shape `cc_<gateway>-docpilotai2999_001-` — **no country suffix**, ends at the trailing hyphen | `subscription` — ASSUMED, see flag 2 | `29.99` | `0.01` (no trial stated) | `0` — ASSUMED no trial, see flag 2 | TBC — see flag 3 (`28` is the house default; requester said "a month") | `USD` — ASSUMED from "$", confirm against target country | `no` — ASSUMED | `no` |

## Flags — read these before building

1. **Slug must not end with a country code.** Whatever billing supplies, it ends at the trailing
   hyphen: `cc_<gateway>-docpilotai2999_001-`. The country is appended at runtime from `d_country`.
   A slug pasted as `...-us` produces a doubled country and a broken billing reference. Billing
   systems display the country as part of the reference, so it arrives that way in good faith.

2. **Plan type is stated as a plain subscription, with no trial.** "29.99 a month" was read as
   `subscription`, trial days `0`. If a trial is actually intended, this must change to
   `trial-then-subscription` with an explicit trial price and trial days — the plan type drives the
   billing copy rendered on the page, so getting it wrong is a compliance problem rather than a
   wording preference.

3. **"A month" is not a billing cycle value.** The panel takes days. The house default for these
   pages is `28`, which bills 13 times a year, not 12. If the intent is genuinely monthly, the cycle
   is `30` and the copy can say "per month"; if it is `28`, the page copy must say "every 28 days"
   and not "monthly". Requester needs to pick one.

4. **Apple Pay only means no fallback.** With both Google Pay and Card Submit off, any visitor
   without an Apple Pay–capable device/browser has no way to convert. That is a legitimate choice,
   but it is worth an explicit confirmation rather than an inference from one phrase.

5. **Currency was inferred from a dollar sign.** `$29.99` was read as USD. It could be CAD, AUD or
   another dollar market, and the target country is still open — these two must be answered together.

6. **Apple Pay merchant identifier is a hard blocker, not a nice-to-have.** Apple validates the
   merchant identifier against the serving domain during merchant validation. An identifier borrowed
   from a sibling product can fail live Apple Pay sessions on docpilotai.com. Since this page is
   Apple Pay only, a wrong identifier means the page cannot take a single payment.

## Blocking

- Target country and `d_country` default — requester
- Currency (assumed USD from "$") — requester
- Billing cycle: 28 or 30 days, and the matching page copy — requester
- Gateway (`celeris` / `maxpay` / `acquired` / `aci-pxp`) — billing team
- Bank name **and** bank ID — billing team
- MCC / legal entity — billing / compliance
- Billing slug, without country suffix — billing team
- Apple Pay merchant identifier for `docpilotai.com` — Apple developer account owner
- Supported card networks — billing team / acquirer
- Creative (`download` / `video` / comp-only) — requester
- Publish on creation, or leave unpublished — requester
- Confirmation that no docpilotai page already exists — requester

## Filled in by the builder

| Slug | Live page | Panel edit link |
| --- | --- | --- |
| | | |
