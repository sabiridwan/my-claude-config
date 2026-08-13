# Prepared panel config — xrlab360 celeris one-off (Apple Pay only)

Ready to paste into `panel.ouisys.com/dynamic-pages/create-credit-card` **once the three blockers
in `verification-findings.md` are cleared**. Values marked `⚠ CONFIRM` are the ticket's values that
failed verification; values marked `→ derived` are taken from the closest verified production
precedent (page_config **1048/1049/1050**, the celeris one-off + Apple-Pay-only cohort).

---

## Page identity

| Field | Value | Source |
|---|---|---|
| Page name | `xx-cc-xrlab360-applepay-celeris-download-oneoff-gcomp-dyn` | → derived from `xx-cc-xr-vreducationlab-docaihelp-applepay-celeris-download-oneoff-gcomp-dyn`. Verify unique across Published / Unpublished / Hidden before saving. |
| Country | `XX` | all cc pages |
| Vertical | `credit-card` | all cc pages |
| Template | ⚠ **BLOCKED** — `cc-dynamic-xrlab360-template-gcomp` v3 does not exist | must be created + built + uploaded first |
| Template (existing alternative) | `cc-dynamic-xrlab360-template-download-nid-gcomp`, template_id 231, latest v5 | panel — but this build renders trial/monthly copy, see below |

## pageConfigs

```jsonc
{
  "slug": "⚠ CONFIRM",              // ticket says cc_acquired-xrlab360portal5999_000-
                                     // that is an Acquired slug already live on 2 Acquired pages.
                                     // celeris convention → cc_celerispay-xrlab360portal5999-
  "gateway": "celeris",              // ticket
  "service": {
    "id": "xrlab360",
    "displayName": "XR Lab 360"      // → derived, page_config 1010
  },
  "flags": { "forceComp": false },   // → derived; true kills the non-comp creative + ?non-comp=true QA path
  "paymentMethods": ["applepay"],    // ticket (Apple Pay only) — matches one-off cohort exactly
  "cardMccInformation": { /* ⚠ NOT SPECIFIED — Prizeflix B.V. (id 4) or PEPPEROSE LIMITED (id 11) */ },
  "payments": {
    "applePay": {
      "supportedNetworks": ["visa", "masterCard", "maestro"],
      "merchantCapabilities": ["supports3DS", "supportsDebit", "supportsCredit"],
      "label": "⚠ NOT SPECIFIED",              // one-off cohort uses "for Prizeflix B.V"
      "merchantIdentifier": "⚠ NOT SPECIFIED", // one-off cohort uses merchant.com.xracademy.online.2
      "bankId": "⚠ CONFIRM",                   // ticket says 42; 42 unseen on any page.
                                               // celeris one-off cohort uses 173. 41 also exists.
      "requiredBillingContactFields": [],
      "requiredShippingContactFields": ["email"]
    }
    // no googlePay block — Apple Pay only
    // no card block — the Card Create wizard has no Card section; this is normal
  },
  "plan": {
    "type": "one-off",               // → derived; required for a genuine one-off
    "fullPrice": "59.99",            // ticket
    "trialPrice": "59.99",           // → derived; one-off sets trialPrice == fullPrice
    "currency": "EUR",               // ticket
    "trialDays": 0,                  // → derived
    "billingCycleDays": 0,           // → derived
    "isLocalCurrency": false         // → derived from one-off cohort (page 1010 uses true — confirm)
  },
  "env": {
    "page": "xx-cc-xrlab360-applepay-celeris-download-oneoff-gcomp-dyn",
    "country": "XX",
    "title": "XR Lab 360",
    "strategy": "credit-card"
  },
  "vertical": "credit-card"
}
```

---

## Why the template blocker also blocks the price copy

Even with `plan.type: "one-off"` set correctly, the current xrlab360 build
(`cc-dynamic-xrlab360-template-download-nid-gcomp` v5) renders subscription wording. From
`src/checkout/PaymentPage.tsx`:

```
L115  {trialPrice} / {trialLabel} — then {fullPrice} / monthly after the first period.
L119  Per monthly after {trialLabel}
L123  Try for {plan.trialDays || 1} day only for {formatPrice(plan.trialPrice)}
```

`plan.trialDays || 1` means `trialDays: 0` still prints "Try for 1 day". A one-off page on this
build would advertise a trial-then-monthly subscription for a single 59.99 charge. The new
`cc-dynamic-xrlab360-template-gcomp` build has to branch on `plan.type === 'one-off'` and drop the
trial/monthly copy before the page is fit to publish.

---

## Order of work once values are confirmed

1. **Confirm slug, bankId, and template name/version** (see `verification-findings.md`).
2. **Create the repo + build** for `cc-dynamic-xrlab360-template-gcomp` if that is really the
   intended template — one-off copy branch included. Reference build:
   `cc-dynamic-vreducationlab-template-gcomp` v4, which is what the live one-off pages run on.
   - repo name must equal the template name exactly
   - `source ~/.zshrc` first (AWS keys), Node must be `.nvmrc` v20.12.2
   - `expect -f deploy-auto.exp "v1 — xrlab360 one-off checkout"` — `deploy.sh` cannot be piped
3. **Panel → create the Template** with that exact name, Country `XX`.
4. **Panel → `/dynamic-pages/create-credit-card`**, select the template + version, fill the config
   above.
   - **Never type in the MCC combobox** — its filter throws `m.toLowerCase is not a function` and
     crashes the panel, losing every field already entered. Click and pick from the list.
5. **QA on staging** at `https://staging.mouisys.com/<xcid>` — Apple Pay path, comp creative and
   `?non-comp=true`, and confirm the summary shows a single 59.99 charge with no trial or monthly
   wording.
6. **Publish** from the Unpublished list → row `Actions` → `Publish`. Do not use
   `yarn publish:page` — it 404s in this repo layout.
7. Report back both the live URL and the panel edit URL.

## Do not touch

Live XR Lab 360 pages `xh44c` and `xpkti` — editing/cloning them needs explicit approval
(standing rule in the repo `CLAUDE.md`).
