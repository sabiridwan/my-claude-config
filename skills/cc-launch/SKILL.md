---
name: "cc-launch"
description: "Orchestrate a full Sam Media / Ouisys credit-card landing page from request to QA in one flow: create/clone the page in the panel, scaffold the LP + payments, wire and verify, hand off the credentialed build/upload/publish, then run the QA pass. Use for \"launch a new CC page end to end\", \"spin up and test an LP\", \"cc-launch\", \"take a product from zero to a tested page\", or when someone wants the whole credit-card pipeline driven for them rather than one step."
---

# cc-launch — end-to-end credit-card LP orchestrator

Drive a new Sam Media / Ouisys credit-card landing page from a product request all the way to a
QA'd, published (or ready-to-publish) page. This skill **orchestrates** the specialist skills in
order and hands off the one step that needs the user's credentials — it does not reimplement
their work.

## The pipeline it runs

```
1. Gather inputs (once)        -> shared product config
2. Panel: create / clone page  -> cc-ouisys-panel   (produces the page config + id)
3. Scaffold LP + payments      -> cc-dynamic-lp      (which calls cc-payment-integration)
4. Wire checkout + verify      -> cc-dynamic-lp verify
5. Build -> upload -> publish   -> HAND OFF to the user (needs repo/AWS/panel creds)
6. QA the live/preview page    -> cc-tester          (posts report to the Notion ticket)
```

Announce the plan up front as a short checklist, then walk it. Keep a running status so the user
always knows which stage they're in and what's left.

## 1. Gather inputs once

Collect the union of what the downstream skills need, so the user answers once:

- Identity: `serviceId`, `serviceDisplayName`, `country` (default `xx`), `creative`
  (`none|download|video`), `nid`. These derive the project name (see cc-dynamic-lp).
- Checkout backend keys: `slug`, `gateway` (`celeris|maxpay|ecardon|acquired`), `bankId`
  (card/applePay/googlePay), Apple `merchantIdentifier`, Google `gatewayMerchantId`.
- Payment methods + order; consent flags; branding (colors, font, logo).
- Ticket: the Notion ticket URL/id for this page (so cc-tester can post the QA report there).
- Prices come from the panel config at runtime — never hardcode; `devFallbackPlan` is dev-only.

If a `product.json` already exists, read it and only ask for gaps.

## 2. Create or clone the page in the panel

Invoke **cc-ouisys-panel**. Create a new credit-card page (or clone an existing one if the user
is spinning a variant), including the "create a Template named the same as the git repo" step.
Capture the resulting page id / config — the next steps need `page` to equal the repo name.

## 3. Scaffold the LP + payment core

Invoke **cc-dynamic-lp** with the gathered config. It first **extracts the product's real brand**
from its live site (via Claude in Chrome — product SPAs won't `web_fetch`): colors, typography, logo.
It then clones the cc-dynamic template, applies that brand, and embeds **cc-payment-integration** for
card + Apple Pay + Google Pay (store-standard wallet buttons, Apple Pay SDK for the Chrome QR flow)
plus the **comp checkout AND the non-comp creative**. Confirm the derived project name matches the
`.env` `page` and the git repo name.

## 4. Wire and verify

Follow the generated `PAYMENT_WIRING.md`, then run the cc-dynamic-lp verify script. Do not
proceed past a red verify — fix hardcoded prices, absolute URLs, loader/early-return issues, or
comp/non-comp timing first.

## 5. Build, upload, publish (HAND OFF)

This step needs the user's repo, AWS, and panel credentials, so it runs in **their** authenticated
environment, not here. Do not attempt it or ask for secrets. Instead, print the exact command
sequence for them to run and what each does:

1. `yarn pull:config id=<id>` — sync `config.json` + `.env` from the panel page.
2. commit (git repo name must equal `.env` `page`).
3. `yarn build:upload` — build client + SSR, upload to S3, record via `upload-template`.
4. `yarn publish:page` — promote staging->production, call `release-page`; prints the preview URL.

Ask them to paste back the preview / production URL when it's live.

## 6. QA the page

Once the URL is live, invoke **cc-tester** on it with the Notion ticket. It dry-runs card / Apple
Pay / Google Pay to API submission, exercises **both the comp checkout and the non-comp creative**
(`?non-comp=true`), checks content + pricing (incl. per-country wallet amounts) vs config, scans for
company leakage, walks the ticket, and posts the pass/fail report back to the ticket. Relay the summary.

## Orchestration rules

- **One stage at a time; confirm before side-effectful ones** — creating/publishing a panel page
  and posting to a ticket are actions the user should green-light.
- **Never hold or enter credentials.** Step 5 is always a hand-off.
- **Stop on failure.** A red verify (step 4) or a FAIL in cc-tester (step 6) pauses the pipeline;
  surface it, fix or hand back, then resume — don't march past a failure.
- **Resumable.** If the user already did an earlier stage (page exists, project scaffolded), skip
  to the right step rather than restarting.
- Keep the checklist visible and mark stages done as you go.
