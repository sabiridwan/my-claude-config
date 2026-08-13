Ticket drafted — `ticket.md`. Three one-off Acquired pages on smartpdfdesk.com, DE, Apple Pay + Google Pay, with all three slugs, prices and plan fields laid out ready to paste into Card Create.

Four things I need to flag before anyone opens the panel.

**1. Drop the `-de` from the slugs.** Enter them ending in a bare hyphen:

| Enter in the panel | What runs in production |
|---|---|
| `cc_acquired-smartpdfdesk2999_001-` | `cc_acquired-smartpdfdesk2999_001-de` |
| `cc_acquired-smartpdfdesk1999_002-` | `cc_acquired-smartpdfdesk1999_002-de` |
| `cc_acquired-smartpdfdesk999_003-` | `cc_acquired-smartpdfdesk999_003-de` |

The country is appended at runtime from `d_country` — `RootContext.tsx:58` does `slug + country`. Pasting the `-de` gives you `…_001-dede` on every request and the billing lookup fails. All 41 live Acquired pages in the panel are stored with the bare trailing hyphen, and the hyphen itself is load-bearing (the local-currency branch strips it with `slice(0, -1)`). This is the CC-377 bug that shipped four wrong live pages.

**2. Bank ID 88 — is that a typo for 8?** Every Acquired page in the panel, all 41 of them across six templates, uses `bankId: 8` on both wallet blocks. `88` doesn't appear anywhere in the panel on any gateway. I didn't want to silently substitute 8 in case 88 is a genuinely new one, so both values are in the ticket and it needs your call. Wrong bank ID fails at authorisation and is invisible in the panel after saving.

**3. The current smartpdfdesk template can't serve Acquired as-is.** `cc-dynamic-smartpdfdesk-template-download-gcomp` (template 251) is ACI-PXP. `Root.tsx:110` gates the whole page tree on `window.ApplePaySession || isAciPxp`, so with `gateway: acquired` every Android visitor gets a blank page — Google Pay would be unreachable, which is the main thing you asked for. There's also no card form on the non-ACI-PXP branch. Options in §5.3: fork an Acquired-native template (`cc-dynamic-template-download-nid-gcomp` v25, or the omnilearnhub/streamtrainfit forks of it) and rebrand, or patch 251. Needs a decision either way.

**4. Set Trial Price = Price before switching Plan Type to one-off.** The field hides on "one off" but still saves whatever was in it, default `0.01`. Your two existing one-off smartpdfdesk pages (1057, 1060) both carry that leftover right now — they survive it only because that template routes through `planShape.ts`. On a template without it you'd charge €0.01 on a €29.99 page.

Still missing and blocking creation: MCC / legal entity (existing smartpdfdesk pages are Pepperose id 11, most Acquired pages are Prizeflix id 4 — different entities on the statement), service ID and display name, the Apple Pay merchant identifier for smartpdfdesk.com, and the Google Pay `gatewayMerchantId` / `merchantId`. Do not let the panel's prefilled wallet values through — it pre-fills another merchant's identifiers and saves them as-is, which is why all five existing smartpdfdesk pages currently have an empty merchant identifier and an inherited `bankId: 4`, wallet buttons that render and then fail at tap. Also unstated: whether Card Submit is on (I've assumed yes) and whether to publish or leave in staging (I've assumed staging until QA).

Everything else I've defaulted to match the five live smartpdfdesk pages: country `XX` with `d_country=de`, EUR, `isLocalCurrency: false`, `forceComp: false`, download creative, `masterCard/maestro/visa`. Proposed page names are in the ticket — flag if you want a different formula, and they'll need a uniqueness check across Published, Unpublished and Hidden before creation.
