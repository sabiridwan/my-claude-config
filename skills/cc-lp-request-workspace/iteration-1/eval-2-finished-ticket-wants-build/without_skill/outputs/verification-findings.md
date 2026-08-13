# xrlab360 CC page — verification of the signed-off ticket values

Date: 2026-08-13
Checked by: read-only Ouisys panel MCP (`sabi@sam-media.com`, admin), S3 template probes, local repos under `/Users/sabiridwan/SamMedia/credit-card/`.

Evidence base: 212 unique dynamic-page configs pulled from the panel (all `celeris`-named pages,
all `xrlab360`-named pages, plus a general sample), the S3 template bucket, and the
`cc-dynamic-xrlab360-template-download-nid-gcomp` repo + its `CLAUDE.md`.

---

## Ticket as supplied

| Field | Ticket value |
|---|---|
| slug | `cc_acquired-xrlab360portal5999_000-` |
| gateway | celeris |
| bank id | 42 |
| plan | one-off 59.99 EUR |
| template | `cc-dynamic-xrlab360-template-gcomp` v3 |
| payment methods | Apple Pay only |

---

## Field-by-field result

### 1. Template `cc-dynamic-xrlab360-template-gcomp` v3 — DOES NOT EXIST (blocker)

Probed the S3 template bucket directly:

```
cc-dynamic-xrlab360-template-gcomp                  v1 404  v2 404  v3 404  v4 404
cc-dynamic-xrlab360-template-download-nid-gcomp     v1 200  v2 200  v3 200  v4 200  v5 200
```

- No template of that name exists at any version.
- No local repo of that name: `/Users/sabiridwan/SamMedia/credit-card/cc-template/` contains
  `cc-dynamic-xrlab360-template-download-nid-gcomp`, not `cc-dynamic-xrlab360-template-gcomp`.
- The panel currently knows only `cc-dynamic-xrlab360-template-download-nid-gcomp`
  (template_id **231**, latest **v5**, `template_version_id` 1889).

The 404 probe method is sound — the same URL shape returns 200 with `<title>XR Lab 360</title>`
for the template that does exist.

Most likely reading: the ticket wants the **xrlab360 equivalent of
`cc-dynamic-vreducationlab-template-gcomp`** (same naming shape, and that is the template the
existing celeris one-off pages run on, currently v4). That repo has to be built and uploaded
before any page can point at it. A page cannot be created against a template that has no build.

### 2. Slug prefix contradicts the gateway (blocker)

Across the 212 configs read:

| gateway | slug prefix | count |
|---|---|---|
| celeris | `cc_celerispay-…` | 115 |
| celeris | `cc_acquired-…` | 1 |
| acquired | `cc_acquired-…` | 40 |
| aci-pxp | `cc_acipxp-…` | 5 |

The single celeris + `cc_acquired-` exception is page_config **483**
(`xx-cc-xr-vreducationlab-xrlab360-applepay-acquired-tst-gcomp-dyn`), whose slug is literally
`cc_acquired-Acquired_test_service-` — an abandoned test page, not a pattern to copy.

`cc_acquired-xrlab360portal5999_000-` is an **Acquired** billing slug. It is currently in
production use on two Acquired pages:

- page_config **1010** `xx-cc-xrlab360-applepay-googlepay-acquired-lc-download-gcomp-dyn` (xcid `x8mqm`)
- page_config **727** `xx-cc-xr-intellectvr-xrlab360-zerotrial-applepay-acquired-download-gcomp-dyn`

Pointing that slug at gateway celeris would route charges for an Acquired-provisioned service
through Celeris. Every real celeris one-off page uses a `cc_celerispay-` slug with no `_NNN`
counter suffix, e.g. `cc_celerispay-docaihelp1999-`, `cc_celerispay-cvassistant1999-`,
`cc_celerispay-cosmicmatchlove999-`.

Expected shape for this product/price would be something like `cc_celerispay-xrlab360portal5999-`
— but slugs are provisioned by billing/ops, not invented, so this must be confirmed, not guessed.

### 3. bankId 42 — unattested for celeris (blocker)

bankIds actually observed, by gateway:

| gateway | bankIds seen |
|---|---|
| acquired | 8 (80 occurrences) |
| aci-pxp | 4 |
| celeris | 6 (120), 4 (82), 74 (16), 173 (8), 41 (4), 7 (2) |

**42 does not appear on any page.** 41 does. The three current celeris one-off + Apple-Pay-only
pages (page_config 1048/1049/1050, template `cc-dynamic-vreducationlab-template-gcomp` v4) all use
bankId **173**.

42 is plausibly a typo for 41, or the value should be 173 to match the current one-off cohort.
Cannot be resolved without confirmation.

### 4. One-off 59.99 — plan shape is known, but this template can't render it

The canonical one-off `plan` block (from page_config 1048/1049/1050):

```json
"plan": {
  "type": "one-off",
  "fullPrice": "19.99",
  "trialPrice": "19.99",
  "currency": "EUR",
  "trialDays": 0,
  "billingCycleDays": 0,
  "isLocalCurrency": false
}
```

i.e. `type: "one-off"`, `trialPrice == fullPrice`, both day counts 0.

The problem is the **page code**, not the config. In
`cc-dynamic-xrlab360-template-download-nid-gcomp/src/checkout/PaymentPage.tsx` the summary panel
renders subscription copy unconditionally:

- L115 `{trialPrice} / {trialLabel} — then {fullPrice} / monthly after the first period.`
- L119 `Per monthly after {trialLabel}`
- L123 `Try for {plan.trialDays || 1} day only for {formatPrice(plan.trialPrice)}`

Note L123's `|| 1` — with `trialDays: 0` it prints "Try for 1 day". Neither the local xrlab360
repo nor the local vreducationlab repo has any `plan.type` / one-off branch. So a one-off page
built on the existing xrlab360 template would display a trial-then-monthly offer for what is
actually a single 59.99 charge. That is a compliance problem, not a cosmetic one.

This is a further reason the ticket's separate `-template-gcomp` build is needed: it has to carry
one-off copy.

### 5. Apple Pay only — supported, config known

`paymentConfig.ts` reads `pageConfigs.paymentMethods` and maps the panel's lowercase names
(`applepay` / `googlepay` / `ccsubmit`). The one-off reference pages set:

```json
"paymentMethods": ["applepay"]
```

So this part of the ticket is fine. Note the Card Create wizard has no Card section at all, so a
missing `card` key in `payments` is normal.

---

## Fields the ticket does not specify

| Field | Needed because |
|---|---|
| **Page name** | Globally unique; the panel requires it. Suggested: `xx-cc-xrlab360-applepay-celeris-download-oneoff-gcomp-dyn` (mirrors `xx-cc-xr-vreducationlab-docaihelp-applepay-celeris-download-oneoff-gcomp-dyn`). Not yet uniqueness-checked against Hidden. |
| **MCC** | Existing xrlab360 page 1010 uses PEPPEROSE LIMITED (id 11); the celeris one-off cohort uses Prizeflix B.V. (id 4). These imply different Apple Pay labels and different statement descriptors. |
| **Apple Pay merchantIdentifier** | Must be one registered against the celeris bank. Acquired xrlab360 pages use `merchant.com.xracademy.online.2`; the celeris one-off cohort also uses `merchant.com.xracademy.online.2`, but that pairs with bankId 173, not 42. |
| **Apple Pay label** | One-off cohort uses `"for Prizeflix B.V"`; xrlab360 acquired page uses `""`. Follows from the MCC choice. |
| **isLocalCurrency** | One-off cohort: `false`. Existing xrlab360 page 1010: `true`. A one-off with local currency changes the wallet amount per country. |
| **Publish or leave staging** | All 14 existing xrlab360 pages are `version_status: staging`. |

---

## Existing xrlab360 pages (for context / duplicate check)

14 pages match `xrlab360`; all credit-card ones run gateway `acquired` on template
`cc-dynamic-template-download-nid-gcomp` or `…-xrlab360-template-download-nid-gcomp`. None is a
celeris one-off, so the requested page is genuinely new — it is not a duplicate. The nearest
neighbour is page_config **1010** / xcid `x8mqm` (Sabi, 2026-07-31, staging).

Repo `CLAUDE.md` also carries a standing instruction: the live `xh44c` and `xpkti` XR Lab 360
pages must not be edited or cloned without explicit approval.

---

## Conclusion

3 of the 5 supplied fields fail verification against production precedent, and one of them
(the template) is a hard blocker that makes page creation impossible regardless of the others.
Recommendation: do not create the page; confirm slug, bankId and template first.
