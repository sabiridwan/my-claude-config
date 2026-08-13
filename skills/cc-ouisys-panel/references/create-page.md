# Create a new credit-card page (Card Create wizard)

Route: `/dynamic-pages/create-credit-card`. Two steps: **1 Page Information** → **2 Confirm & Save**.
Step 1 is safe to fill and re-fill. Step 2 shows the raw JSON payload and its **Save** button is the
committing action — read the payload back to the user and get a yes before clicking it.

Field map below is from a real run (2026-07-31), verified working. **Every identifier shown is a
placeholder** — gateway/merchant IDs, slugs, template ids and xcids are per-page and must come from
the ticket or a live sibling's config, never copied from here.

## Prerequisites — both must already be true

1. **A Template exists whose name == the git repo name.** Templates list → `Create`.
2. **A build version is attached to that template.** The wizard's `Template Version` field is
   **required** and reads from the template's uploaded versions — an empty template gives you nothing
   to pick, so you cannot create the page. Run `cc-dynamic-lp`'s build+upload first (produces `v1`).

Check both at `/dynamic-pages/templates/details/<id>` → **Template Versions** tab before starting.
It lists `ID / Version / Version Url / Reason / Created By`. The `ID` there is the
`template_version_id` that ends up in the payload.

> **Order matters.** Page creation is the *last* code-side step, not the first. Template → scaffold →
> build+upload → **then** create the page.

## Step 1 field map

`*` = required. Country and Vertical are locked by the route.

### Template & Version
| Field | Notes |
| --- | --- |
| Country * | Locked (e.g. `XX`) — comes from the template. |
| Template * | Searchable. Type part of the repo name and pick the exact match. |
| Template Version * | Disabled until a template is chosen. Options render as `(vN) <tag message>`. |
| Page Name * | The **page** name — see naming rules below. **Not** the template/repo name. |

### Page Meta
| Field | Notes |
| --- | --- |
| Title * | User-facing page title (`<title>`). No canonical source in most tickets — placeholder pattern is `<Service> — Try it now`. Confirm with the user; easy to change later via `Edit`. |
| Vertical * | Locked to `credit-card`. |

### Service & Slug
| Field | Notes |
| --- | --- |
| Slug * | e.g. `cc_acquired-<product>5999_000-`. Carries acquirer + price; bank/Mid derive from it. |
| Service ID * | e.g. `streamtrainfit` → payload `service.id`. |
| Service Display Name * | e.g. `Streamtrainfit` → payload `service.displayName`. Shown in the UI. |

### MCC Information
Single combobox, `Select an MCC`. Selecting one expands a read-only **Selected MCC Details** card
(MCC Code, Name, Registration Number, Email, CEO, Address, Phone) plus a `Remove` link — use it to
confirm you picked the right legal entity.

> **DO NOT TYPE IN THE MCC COMBOBOX.** Typing into its search field crashes the whole panel to
> `Something went wrong. — m.toLowerCase is not a function`, and **every field you already filled is
> lost**. The option list isn't plain strings, so the filter throws. **Click the combobox and pick
> from the list.** If the list is long, scroll it — still no typing.
>
> Because of this bug, select the MCC **early** — it survives while you refill the rest — or accept
> that one stray keystroke here costs you the whole form.

### Gateway & Flags
| Field | Notes |
| --- | --- |
| Gateway * | Dropdown, options: `celeris` (default), `maxpay`, `acquired`, `aci-pxp`. |
| Force Comp | Toggle, default **off**. Leave off unless asked — on kills the non-comp creative and blocks the `?non-comp=true` QA path (`forceComp` always wins). |

### Payments — Google Pay
| Field | Default | Notes |
| --- | --- | --- |
| Allowed Auth Methods | `PAN_ONLY`, `CRYPTOGRAM_3DS` | Usually keep. |
| Allowed Card Networks | `MASTERCARD`, `VISA` | Usually keep. |
| Gateway * | `celerispay` prefilled | **Overwrite** to match the real gateway (e.g. `acquired`). |
| Gateway Merchant ID * | empty | e.g. `AGDS0000000001`. |
| Bank ID * | `4` prefilled | **Overwrite** (e.g. `8`). |
| Merchant ID * | empty | e.g. `BCR2DN0EXAMPLE00`. |
| Merchant Name * | empty | Shown **to the user** in the Google Pay sheet. Use the **service's own domain** (e.g. `<product>.com`) — that is what every live page in this family carries. Do NOT copy the grey placeholder (`Prizeflix B.V.`): it belongs to a *different* legal entity. The MCC legal entity is a defensible alternative, but the domain form is the observed convention; if in doubt read it off a live sibling's `pageConfigs.payments.googlePay.merchantInfo.merchantName`. |
| Total Price Status * | `FINAL` | Keep. |

Note the prefilled `celerispay` / `4` are **real values, not placeholders** — they save as-is if you
don't overwrite them. Empty fields show grey placeholder text that happens to look like a plausible
value (`AGDS0000000001`, `BCR2DN0EXAMPLE00`); those are *not* values and must be typed in.

### Payments — Apple Pay
| Field | Default | Notes |
| --- | --- | --- |
| Supported Networks | `visa`, `masterCard`, `maestro` | Usually keep. |
| Merchant Capabilities | `supports3DS`, `supportsDebit`, `supportsCredit` | Usually keep. |
| Label | empty (optional) | Apple Pay sheet line item. Safe to leave empty. |
| Merchant Identifier * | empty | e.g. `merchant.com.example.product.1`. |
| Bank ID * | `4` prefilled | **Overwrite** (e.g. `8`). |
| Required Billing Contact Fields | empty | Optional. |
| Required Shipping Contact Fields | `email` | Usually keep. |

### Plan — the pricing source of truth
| Field | Default | Notes |
| --- | --- | --- |
| **Plan Type *** | `Trial, then subscription` | `subscription` · `trial-then-subscription` · `one-off`. **Decides which fields below render, and the billing copy on the page.** |
| Full Price * | `49.99` | Labelled **`Price`** when Plan Type is One Off. |
| Currency * | `EUR` | |
| Trial Price * | `0.01` | Only shown for `trial-then-subscription`. |
| Trial Days * | `1` | Only shown for `trial-then-subscription`. |
| Billing Cycle (days) * | `28` | Hidden for `one-off` — a one-off never renews. |
| Is Local Currency | **on** | |

These defaults match the common 0.01-trial EUR page, so often nothing to change — but read them back
to the user explicitly rather than assuming, because they are the live prices.

**Pick Plan Type before the prices.** It controls which fields exist, and the saved payload zeroes
`trialDays` / `billingCycleDays` for the shapes they do not apply to — so a one-off saves with no
trial and no renewal period rather than inheriting them from whatever it was cloned from.

**A one-off is not "a subscription with no trial".** `subscription` still renews every
`billingCycleDays`; `one-off` charges once and never renews. Choosing `subscription` for a
single-charge product makes the page advertise auto-renewal for something that does not renew —
a compliance problem, not a wording preference. If the ticket says *One Off = Yes*, the answer is
`one-off`.

`trialPrice` is **never** derived from `fullPrice`; it saves exactly as entered. Landing pages read
`plan.trialPrice` for the no-trial charge amount, so do not assume the two are interchangeable.

Pages created before Plan Type existed have no `type`. The panel infers one on load — `trialDays > 0`
→ `trial-then-subscription`, otherwise `subscription` — so opening and re-saving an old page keeps its
behaviour. Nothing is ever inferred as `one-off`; that can only be chosen deliberately.

### There is NO Card section
The wizard exposes **only** Google Pay and Apple Pay. The saved payload's `payments` therefore
contains just `googlePay` + `applePay` — there is no `payments.card` and nothing to toggle.
**Which tabs actually render is decided in the page code, not the panel.** A build that ships a Card
tab will show Card on the live page even though the config has no `card` key (verified: the
Streamtrainfit page renders Apple Pay / Google Pay / Card from a card-less config). So "should Card be
enabled?" is not a panel question — don't block on it here.

## Page Name vs Template Name — they are DIFFERENT

- **Template name == `.env` `page` == git repo name.** This one must match exactly or the upload's
  `pre:build` aborts. Example: `cc-dynamic-<product>-template-download-nid-gcomp`.
- **Page name** follows the credit-card naming convention in the parent SKILL.md and is its own
  string. Example:
  `xx-cc-<bank>-<domain>-<product>-applepay-googlepay-acquired-lc-download-gcomp-dyn`. The `<bank>`
  token is the acquiring bank and is required on new pages — if the ticket gives only a numeric Bank
  ID, that's a blocker to raise, not a value to derive.

These are unrelated strings and the page works fine with them differing — verified. Do not try to
force them equal.

## Step 2 — review the payload

Step 2 renders the JSON to be POSTed, with `service` / `flags` / `cardMccInformation` / `payments` /
`plan` / `env` collapsed. **Expand them** (click the ▸ triangles) and check against the target config
before saving. Shape:

```jsonc
{
  "country": "XX",
  "pageName": "xx-cc-…-dyn",
  "pageConfigs": {
    "slug": "cc_acquired-<product>5999_000-",
    "service": { "id": "streamtrainfit", "displayName": "Streamtrainfit" },
    "gateway": "acquired",
    "flags": { "forceComp": false },
    "cardMccInformation": { /* … */ },
    "payments": { "googlePay": {…}, "applePay": {…} },   // no "card" — by design
    "plan": { "fullPrice": "49.99", "trialPrice": "0.01", "currency": "EUR",
              "trialDays": 1, "billingCycleDays": 28, "isLocalCurrency": true },
    "env": { /* … */ },
    "vertical": "credit-card"
  },
  "template_id": <template-id>,
  "template_version_id": <version-id>,
  "template_version_url": "https://s3.eu-central-1.amazonaws.com/mobirun/os-ui/static/<page>/html/v1_index.html",
  "template_name": "cc-dynamic-<product>-template-download-nid-gcomp",
  "template_version": "v1",
  "username": "…",
  "strategy": "credit-card"
}
```

Confirm `template_id` / `template_version_id` / `template_version_url` point at the build you just
uploaded. Then **Save** (after the user's go-ahead).

## After saving

Toast: `Credit Card configuration created 🎉`, and you land on
`/dynamic-pages/unpublished/list` with the new page as row 1. Record from that row:

- **Page Name**, **Country**, **Vertical** (`credit-card`), **Updated By**, **Updated At**
- **Xcid** — e.g. `<xcid>`. This is the page's public id and you need it for the URL.

The row's **Configuration** column shows `Strategy: —` / `Name: —` / `Service:` **blank** for
credit-card pages. That is a list-rendering quirk (those columns are DCB scenario fields); it does
**not** mean the config is empty — verify via the payload or the staging page instead.

### The page is immediately testable on staging, before publishing

`Actions → Preview` opens **`https://staging.mouisys.com/<xcid>`** in a new tab. This serves the real
build with the real panel config while the page is still Unpublished — so **QA here first** (run
`cc-qa` against it) and publish only once it is clean. On that page,
`window.configJson.pageConfigs` is the live config; snapshot it and compare to what you saved.

### Publishing

Row `Actions` → **`Publish`** (the menu also has Preview / View Details / Edit / Clone / Hide /
Delete). This is the traffic-exposing action — get explicit confirmation first.

Do **not** use the repo's `yarn publish:page` for a cc-dynamic page; it is DCB boilerplate and does
not work here (see `cc-dynamic-lp/references/build-upload-contract.md`).

## Panel UI quirks that waste time

- **The `Actions` dropdown renders in a portal.** After clicking it, a screenshot may show no menu.
  Use `find` for the menu items and click by `ref`, or re-screenshot.
- **Clicking a page name or `Quick Preview` in the list may not navigate**, and `View Details` can
  silently do nothing. Go through `Actions` → `Preview` to see the page.
- **Long values are truncated in inputs.** A small coloured chip above the field echoing your full
  value (e.g. the page name) is a hint, **not** a validation error.
- After the MCC crash, the app returns a blank `Something went wrong` screen — re-navigate to
  `/dynamic-pages/create-credit-card` and start over.
