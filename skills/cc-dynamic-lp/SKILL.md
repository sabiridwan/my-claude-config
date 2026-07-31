---
name: cc-dynamic-lp
description: >-
  Scaffold a complete Sam Media / Ouisys cc-dynamic credit-card LANDING PAGE project — the full
  React/TypeScript/Webpack SSR marketing page (hero, pricing, features, footer, localization) plus
  the build → SSR → S3 upload → publish pipeline that makes it uploadable and live in the Ouisys
  panel (panel.ouisys.com/dynamic-pages/create-credit-card). It clones the proven cc-dynamic template
  and wires checkout through the cc-payment-integration skill (card + Apple Pay + Google Pay, no
  widget). Use this whenever someone wants to "create a new landing page / LP", "make a cc-dynamic
  page", "spin up a product page for a product", "build a page I can upload to the panel", scaffold a
  new xhosp checkout landing, or start a new credit-card page project. If the user names a product
  (streamtrainfit, omnilearnhub, xrlab360) and wants a full page (not just the payment form), this
  skill owns the whole project; it calls cc-payment-integration for the payment layer.
---

# cc-dynamic-lp — full Ouisys credit-card landing page

## What this does and why it clones instead of generating

A live Ouisys credit-card page is a full React/TS/Webpack **SSR** project whose build and upload
pipeline depends on the private `ouisys-clients` package (its webpack configs + `dev-tools/` scripts)
and a project `ssr-dynamic.js`. Regenerating that plumbing from scratch would be fragile and would
likely break the panel upload contract. So this skill **clones the proven cc-dynamic reference
template** (exactly how the team makes a new page today), customizes it per product, and swaps the
checkout to the `cc-payment-integration` payment core.

Division of labor:

- **This skill** owns the LP shell + the build/SSR/upload/publish plumbing + panel steps.
- **cc-payment-integration** owns the checkout (card + wallets, direct API posts, no widget/engine).
  This skill invokes it and mounts its `PaymentPage` in the checkout slot.

Read `references/naming-convention.md` (project name = folder = `.env page` = git repo, and the
fixed cc-template location + git remote), `references/project-structure.md` (what's per-product vs
boilerplate) and `references/build-upload-contract.md` (the exact panel/S3/API contract) before
scaffolding.

## When to use

Any request to create/scaffold a full landing page or product page that will be uploaded to the
Ouisys panel: "new LP", "cc-dynamic page", "product page for X", "page I can publish in the panel".
For just the payment form on an existing page, use `cc-payment-integration` directly instead.

## The workflow

### 1. Gather inputs

See `product.example.json`. Collect:

- `serviceId`, `serviceDisplayName`, `country` (default `xx`).
- `creative` (`none|download|video`) and `nid` (default true) — these, with `serviceId`, **derive the
  project name** per `references/naming-convention.md`. You normally do NOT set `productName`; let it
  be derived (e.g. `cc-dynamic-streamtrainfit-template-download-nid-gcomp`). Set `productName`
  explicitly only to override.
- `slug`, `gateway`, `bankId` (card/applePay/googlePay), Apple `merchantIdentifier`, Google
  `gatewayMerchantId` — the checkout backend keys (passed straight to cc-payment-integration).
- `branding`: primary colors, font, logo.
- `paymentMethods`, `devFallbackPlan` (local preview only; real prices come from the panel config).

**Fixed defaults (don't need input):** the project is created at `<cc-template>/<name>` and a git
repo is initialised with origin `git@git.sam-media.com:ouisys/dynamic-templates/xx/<name>.git`. The
derived `<name>` is used as the folder name, `.env page`, and git repo name together — so the upload
`pre:build` (`page === repo name`) passes. Read `references/naming-convention.md` before scaffolding.

### 1b. Extract each product's brand (this is a ticket requirement)

Tickets of this kind say two things at once: **follow the layout/hierarchy/UX of a reference
`/xhosp` page**, AND **apply each product's own logo, colours and typography.** The generated
checkout already reproduces the reference layout (see `cc-payment-integration`'s themeable
`PaymentPage` + `checkout.scss`); your job is to feed it the *product's real brand*, not a guess.

Do NOT guess colours. Product sites are usually client-rendered SPAs, so `web_fetch` returns only a
"Loading…" shell — you must render the JS. Use the Claude-in-Chrome tools:

1. `navigate` to the product site (e.g. `https://www.streamtrainfit.com/`).
2. `computer` screenshot to see the look (dark/light, logo, vibe).
3. `javascript_tool` to sweep computed styles for the real palette + fonts, e.g. collect
   `getComputedStyle(el).color / backgroundColor / fontFamily` frequencies across the DOM and the
   primary button's background. Read the logo from the header `<img>`/SVG.

Then fill the `brand` and `copy` blocks in `product.json` (see `product.example.json`):

```jsonc
"brand": {
  "theme": "dark",                 // dark | light — from the site
  "primary": "#DC2626",            // the accent/CTA colour
  "primaryDark": "#B91C1C", "primarySoft": "#FCA5A5",
  "displayFont": "'Oswald', sans-serif", "bodyFont": "'Montserrat', sans-serif",
  "googleFonts": "https://fonts.googleapis.com/css2?family=Montserrat...&family=Oswald...",
  "logoSvg": "<svg>…</svg>"        // inline logo (or leave empty for a wordmark)
},
"copy": { "benefits": [...], "chargeDescriptor": "STREAMTRAINFIT",
          "tagline": "Discover Your Inner Balance <span>&amp; Strength</span>", "blurb": "…" }
```

The scaffold turns `brand` into a `:root` theme in `checkout.scss` (colours, fonts, dark/light
neutrals, gradients) and injects the Google Fonts `<link>` into `index.html`. The **layout never
changes** — only the theme — which is exactly the ticket's "same layout, each product's brand."

### 2. Scaffold

```bash
node scripts/scaffold.mjs --config <product.json>
# optional overrides:
#   --out <dir>              (default: <cc-template>/<derived-name>)
#   --cc-template-dir <dir>  (default: the cc-template dir next to this skill)
#   --base <template-dir>    (default: cc-dynamic-template-download-nid-gcomp)
#   --git-remote-base <base> (default: git@git.sam-media.com:ouisys/dynamic-templates/xx)
#   --no-git                 (skip git init)
#   --payment-skill <dir>    (default: ../cc-payment-integration)
```

The script: derives the project name and creates it inside `cc-template`; clones the base template
(excluding `node_modules`, `.git`, `dist`, screenshots, `docs/`, scratch dirs); rewrites `.env`
(`page` = derived name, `country`, `strategy`, `defaultService`, …) and `config.json`
(`flowConfig.slug`, `flowConfig.service`); applies branding to `src/styles/_variables.scss`; drops a
logo placeholder at `src/assets/logos/<serviceId>.svg`; invokes `cc-payment-integration` in
`--embed --src-prefix src/checkout` mode so the whole checkout lands self-contained under
`src/checkout/` (no clobbering template files); writes `src/CheckoutSection.tsx` +
`PAYMENT_WIRING.md`; and runs `git init` + adds the `dynamic-templates/xx/<name>` origin.

### 3. Wire the checkout into Root

Follow `PAYMENT_WIRING.md` in the generated project: import `CheckoutSection` and render it where the
template rendered `<FLOWS.CreditCardFlow/>` / the comp payment card. Keep the comp/non-comp gate and
loader from the template — cc-payment-integration's page already honors the same rules, so mount it
inside the existing comp branch.

### 4. Verify

```bash
node scripts/verify.mjs --out <project-dir>
```

Checks: `.env` `page` present (remind it must match the repo name), `config.json` has the product
`slug`/`service`, required build files exist (`ssr-dynamic.js`, `src/index.tsx`, `src/index.ssr.ts`,
`src/Root.tsx`, `package.json` upload scripts), branding applied, `src/payments` present and
type-checks, and the checkout is wired (no leftover unmounted marker). See
`references/build-upload-contract.md` for what a green verify does and does not guarantee (it does
**not** run the private webpack build).

### 5. Build → upload → create page → QA → publish

**Order matters, and it is not what you'd guess.** The panel's Card Create wizard requires a
`Template Version`, which only exists after a build has been uploaded. So the page is created
**after** the build, not before:

1. **Template exists in the panel**, named exactly the git repo name (`cc-ouisys-panel` →
   `cc-ouisys-panel/references/templates.md`). No build attached yet is fine.
2. **Commit** — the upload refuses a dirty tree, and the repo name must equal `.env` `page`.
3. **`bash deploy.sh`** (or `yarn build:upload`) → builds client + SSR, renders `staging.html`,
   uploads to S3 (`os-ui/static/<page>/html/<vN>_index.html`), pushes a `vN` git tag, and records it
   via `POST /api/v1/upload-template`. Produces **v1**.
   - Needs `osui_aws_access_key_id` / `osui_secret_access_key` **exported in the shell**. They
     commonly live in `~/.zshrc`, which is **not** sourced for a non-login shell — `source ~/.zshrc`
     first or the credential check fails.
   - **Cannot be driven with a pipe** — see the pty note below. Use `expect`.
4. **Verify the version attached**: template details → `Template Versions` tab shows the `vN` row and
   its `ID` (= `template_version_id`). Cross-check against the upload's `Upload record saved!` output.
5. **Create the page in the panel** → `cc-ouisys-panel/references/create-page.md`, selecting this
   template + the new version. (`yarn pull:config id=<id>` can later sync `config.json` + `.env` back
   from a saved page config.)
6. **QA on staging** — the new page serves at `https://staging.mouisys.com/<xcid>` while still
   Unpublished. Run `cc-tester` there **before** publishing.
7. **Publish** — panel row `Actions` → `Publish`.

> **`yarn publish:page` does NOT work for a cc-dynamic page — do not run it as step 7.**
> It is DCB-flow boilerplate. It derives its S3 keys as
> `{country}-{slugify(scenario || strategy_scenariosConfig)}-staging.html` → `-production.html`, but a
> cc-dynamic `.env` has **no `scenario`**, and `build:upload` writes `html/staging.html`,
> `html/index.html`, `html/v1_index.html`. The names never match, so it 404s instead of promoting
> anything. Publishing happens in the panel.

#### deploy.sh / build:upload cannot be piped — it needs a pty

Both `pre-build-dynamic.js` (4 prompts: Client / Title / Country / Page) and
`upload-to-s3-tagged.js` (tag message) prompt via **inquirer, which reads stdin in raw mode**:

- `printf '\n\n\n\n' | bash deploy.sh` → the entire buffer is consumed by the **first** prompt as
  keystrokes, then the next prompt dies on EOF: `error Command failed with signal "SIGINT"`.
- `yes "" | bash deploy.sh` → worse: the tag prompt rejects empty messages and loops forever.

Drive it with `expect` instead. The 4 pre-build prompts accept the `.env` defaults on a bare Enter;
the tag message must be non-empty:

```expect
#!/usr/bin/expect -f
set timeout 900
spawn bash deploy.sh
foreach label {Client Title Country Page} {
    expect -re "\\? $label:" { send "\r" }
}
expect -re "Enter a tag message" { send "Uploaded version v1 — <reason>\r" }
expect eof
catch wait result
exit [lindex $result 3]
```

Also pin Node: `.nvmrc` is **v20.12.2**. On Node 21+ `global.navigator` is a read-only getter, so
`ssr-dynamic.js`'s `global.navigator = {...}` throws `TypeError: Cannot set property navigator` and
`build:ssr:server` exits 1. **Never patch `ssr-dynamic.js`** (shared boilerplate) — switch Node. `nvm`
is a shell function and is *not* inherited by a script's subshell, so a `nvm use` in your terminal
does not carry into `deploy.sh`; source `nvm.sh` and `nvm use` inside the script.

## Local dev config (dummy pageConfigs — not published)

Live pages get `window.configJson.pageConfigs` injected by the backend before the bundle runs. Local
dev (`yarn dev`) has no such injection, and the template's `RootContext` reads
`pageConfigs.cardMccInformation.mcc` / `service` / `flags` at first render — so without a config the
page throws `Cannot read properties of undefined (reading 'mcc')`.

The scaffold handles this by injecting a **dummy config into `src/index.html`** inside a build-time
guard:

```html
<% if (process.env.NODE_ENV !== 'production') { %>
  <script>window.configJson = window.configJson || { "pageConfigs": { … } };</script>
<% } %>
```

Why this shape matters: it loads **synchronously in `<head>` before `bundle.js`** (so config exists
before React reads it), it is **dropped from the production build** (the lodash conditional evaluates
to nothing when `NODE_ENV=production`, so it never appears in `staging.html`/the published page), and
it is **never bundled into JS**. The `|| window.configJson` guard also means that if a backend
injection is ever present it always wins. Do **not** replace this with a `.ts`/`.json` import from
source — that would compile the mock into the production bundle. `verify.mjs` fails the build if the
mock is present but unguarded, and warns if any source file imports a bundled dev config.

## Wallet buttons + Apple Pay behavior (store-standard)

The generated wallet buttons use the **official** platform buttons, not custom ones:

- **Google Pay** uses `client.createButton()` (the real "Subscribe with G Pay" button), rendered into
  a host div once `isReadyToPay` passes. On `localhost` it uses the `TEST` environment so it renders
  in dev; on the live domain it uses `PRODUCTION`.
- **Apple Pay** is a store-standard styled button (black, Apple mark + "Pay"), **always visible** —
  including on Chrome. It works cross-browser via the QR / cross-device flow, which requires loading
  Apple's JS SDK: `https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`. The generated
  `ApplePayButton` loads it on mount — once loaded, `window.ApplePaySession` is defined **even on
  desktop Chrome**, so `session.begin()` renders the **QR code** in Chrome and the normal sheet in
  Safari. Do NOT gate the button on `window.ApplePaySession` (hides it on Chrome) and do NOT skip the
  SDK (that's why Chrome shows no QR). Apple Pay only runs over HTTPS with a registered merchant
  domain, so on `http://localhost` it can't — the deployed HTTPS page is where the QR appears.

Because these are the platform buttons, don't restyle their internals — they must look store-standard.

## Comp vs non-comp (the checkout handles BOTH)

Ouisys pages have two layouts and the generated `PaymentPage` renders the right one automatically:

- **Comp** — the full checkout (card + wallet tabs + trust sections + order summary). Shown to most
  traffic.
- **Non-comp** — a full-area **download-animation creative** (`Creative` + `NonComp`) that, on tap,
  triggers the wallet payment (Apple Pay on Apple devices → Google Pay fallback). Shown when the page
  resolves to non-comp.

The decision is made **synchronously** by `resolveMode.decideComp()` (no flash), then confirmed:
non-comp only when `!flags.forceComp` AND `window.ApplePaySession` AND iOS AND outside India — or
forced with `?non-comp=true`. `forceComp` always wins. This mirrors the reference RootContext logic.

Creative assets (`download.webm`, `download-start/end.webp`, ~290 KB) are **bundled with
`cc-payment-integration`** and emitted into `src/checkout/assets/` — the checkout is self-contained
and does NOT depend on the base template's assets, so it works on any base. To use a different
animation, drop replacement files into the skill's `templates/assets/` (or the project's
`src/checkout/assets/`). Apple Pay in non-comp uses the same SDK (QR on desktop). Test non-comp
locally with `?non-comp=true`.

## Two things that bite in this template (and how the scaffold handles them)

1. **`CheckoutSection` must be the PRIMARY view.** The template's `RootWithProviders` wraps the
   template's own `Root` (marketing hero + engine + wallet hooks that throw on insecure http). Render
   `CheckoutSection` directly inside the providers instead — see PAYMENT_WIRING.md. This is why the
   /xhosp page shows the checkout on load rather than the template landing.

2. **Local dev config is a JS module, imported from `CheckoutSection`.** In local dev there's no
   backend-injected `pageConfigs`, so prices show "—" and RootContext can read undefined. The scaffold
   generates `src/checkout/devConfig.ts` (a localhost-guarded mock) and imports it from
   `CheckoutSection` **before** `PaymentPage`. It is NOT imported from the entry (`index.tsx`) because
   entry-file edits don't hot-reload in this webpack, and NOT injected into `index.html` because
   HtmlWebpackPlugin template edits don't hot-reload either — a regular module import does.

## Non-negotiables

- **`page` (.env) must equal the git repo name** — otherwise `pre:build` aborts the upload.
- **Prices come from the panel config at runtime** (`window.configJson.pageConfigs.plan`); the
  `devFallbackPlan` is dev-only. Never hardcode prices in copy (cc-payment-integration enforces this).
- **Same-origin, relative URLs**; the page stays on the product domain (domain preservation) — the
  only off-domain step is the final gateway redirect after payment.
- **Keep the template's SSR loader + comp/non-comp gate.** They prevent a blank server render and
  layout flashes; mount the checkout inside the existing comp branch rather than replacing the gate.
