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
1. Gather inputs (once)         -> shared product config
2. Panel: create the TEMPLATE   -> cc-ouisys-panel   (name == git repo name; no build yet)
3. Scaffold LP + payments       -> cc-dynamic-lp      (which calls cc-payment-integration)
4. Wire checkout + verify       -> cc-dynamic-lp verify
5. Commit -> build -> upload     -> produces template v1 + attaches it
6. Panel: create the PAGE       -> cc-ouisys-panel   (needs v1 to exist; yields the xcid)
7. QA on STAGING (pre-publish)  -> cc-qa          against staging.mouisys.com/<xcid>
   ^^^ YOUR WORK ENDS HERE ^^^
8. Publish                      -> NOT YOURS. The repo owner publishes to production himself.
```

**Panel steps are MCP-first.** Every panel interaction in steps 2 and 6 goes through
`cc-ouisys-panel`, which checks the `ouisys-panel` MCP server (`mcp__ouisys-panel__*`) before
opening the browser — reads and supported writes via MCP (including the Card Create wizard's
`create_page_config`, page `update_page_config`, and template `create_template`), Chrome only for
**Publish** and anything a tool call errors on. Don't navigate to panel.ouisys.com to look something
up that `get_dynamic_page` / `search_dynamic_pages` / `list_mccs` / `list_templates` can answer.

**The page is created after the build, not before.** The Card Create wizard's `Template Version` field
is required and only lists versions that have actually been uploaded, so an unbuilt template gives you
nothing to select. Creating the *template* is step 2; creating the *page* is step 6. Getting this
backwards is the most common way to stall this pipeline.

**For a brand-new product, confirm the GitLab project exists before step 5.** The scaffold sets
`origin` to `git@git.sam-media.com:ouisys/dynamic-templates/xx/<name>.git`, but creating that
*project* is a separate manual step — push-to-create is off. If `git ls-remote origin` or
`git push -u origin main` returns *"project could not be found"*, create it first (GitLab UI, or
`POST /api/v4/projects` with a PAT — SSH keys can push to an existing project but cannot create one).
`build:upload` pushes a `vN` tag, so it fails identically without it.

Announce the plan up front as a short checklist, then walk it. Keep a running status so the user
always knows which stage they're in and what's left.

## 1. Gather inputs once

Collect the union of what the downstream skills need, so the user answers once:

- Identity: `serviceId`, `serviceDisplayName`, `country` (default `xx`), `creative`
  (`none|download|video`), `nid`. These derive the project name (see cc-dynamic-lp).
- Checkout backend keys: `slug`, `gateway` (`celeris|maxpay|ecardon|acquired`), `bankId`
  (card/applePay/googlePay), Apple `merchantIdentifier`, Google `gatewayMerchantId`.
- Payment methods + order; consent flags; branding (colors, font, logo).
- Ticket: the Notion ticket URL/id for this page (so cc-qa can post the QA report there).
- Prices come from the panel config at runtime — never hardcode; `devFallbackPlan` is dev-only.
- **Plan type per page**: `subscription` | `trial-then-subscription` | `one-off`. A ticket table with
  a `One Off` column is stating this per slug (`Yes` → `one-off`). It is a panel field *and* a page-code
  branch, so capture it up front — the page must not advertise renewal for a single charge.
- **One design, many configs.** When a ticket lists several slugs against one design, that is one
  build cloned per row in the panel (step 6), not one project per slug. Scaffold once; the per-row
  differences (slug, prices, plan type) are page configuration. Confirm this reading with the user
  before scaffolding N projects.

If a `product.json` already exists, read it and only ask for gaps.

## 2. Create the Template in the panel (not the page yet)

Invoke **cc-ouisys-panel** → `cc-ouisys-panel/references/templates.md`. Create a Template whose name is **exactly the
git repo name** (== `.env` `page`) with the right Country. It will have no versions attached yet —
that's correct; step 5 produces `v1`.

Do **not** open the Card Create wizard here. The page comes at step 6.

If the user is spinning a variant of an existing page, `Clone` is the shortcut instead — but the clone
still points at a template+version, so the same build prerequisite applies.

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

## 5. Commit, build, upload (runnable here if creds are in the shell)

This needs repo + AWS credentials. It does **not** have to be a hand-off: the keys usually live in
`~/.zshrc`, which a non-login shell doesn't source, so `source ~/.zshrc` and the build runs fine
in-session. Never ask the user to paste secrets; just source their profile.

1. **Commit** — `build:upload` refuses a dirty tree, and the repo name must equal `.env` `page`.
2. **`bash deploy.sh`** (wraps `yarn build:upload`) — builds client + SSR, uploads to S3, pushes a
   `vN` git tag, records via `upload-template`.

Two things that will bite (details in `cc-dynamic-lp` SKILL.md):

- **It cannot be piped.** Both prompting scripts use inquirer in raw mode. `printf '\n\n\n\n' |` is
  eaten by the first prompt then dies `SIGINT`; `yes "" |` loops forever on the tag prompt (empty tag
  messages are rejected). **Drive it with `expect`.**
- **Node must match `.nvmrc` (v20.12.2).** On Node 21+ `ssr-dynamic.js` throws
  `TypeError: Cannot set property navigator`. Never patch `ssr-dynamic.js`.

Then confirm the version attached: template details → `Template Versions` shows the `vN` row; its `ID`
is the `template_version_id`. Cross-check with the `Upload record saved!` output.

## 6. Create the page in the panel

Now that `v1` exists, invoke **cc-ouisys-panel** → `cc-ouisys-panel/references/create-page.md`.
Primary path is the MCP `create_page_config` tool (confirm-first: preview, then `confirm:true`) with
this template + the new version; fall back to the browser Card Create wizard only if the tool errors
or you need the MCC combobox / live preview. Either way, read the payload back to the user and get a
yes before committing.

Capture the **xcid** from the tool's response (`page_config_id` / `version_id` / `xcid`); if any of
those is missing, fall back to `search_dynamic_pages` / `get_dynamic_page` and read it off the
resulting Unpublished row.

Note: there is **no Card section** in the wizard (only Google Pay / Apple Pay). Which payment tabs
render is decided in the page code, so don't stall asking whether to "enable card" panel-side.

## 7. QA on staging — before publishing

The new page already serves at **`https://staging.mouisys.com/<xcid>`** with the real build and real
config while still Unpublished. Invoke **cc-qa** against *that* URL with the Notion ticket. It
dry-runs card / Apple Pay / Google Pay to API submission, exercises **both the comp checkout and the
non-comp creative** (`?non-comp=true`), checks content + pricing (incl. per-country wallet amounts) vs
config, scans for company leakage, walks the ticket, and posts the pass/fail report back. Relay the
summary.

Fix and re-upload (`v2`) rather than handing over a FAIL.

**This is where the flow ends for you.** Do not continue to step 8.

## 8. Publish — NOT YOURS

Standing instruction from the repo owner (2026-08-16), for every credit-card task: **stop at
staging.** Do not click `Actions` → `Publish`, do not promote a campaign's
`staging_template_version` to `published_template_version`, and do not run any publish command.
He does this step manually.

These pages front live paid traffic taking real card payments, so the go/no-go on customer-facing
exposure is a human decision he makes — not something an agent does as a natural-looking last step
of a build-and-upload flow.

Close out instead by handing back:
- the staging URL you QA'd (`https://staging.mouisys.com/<xcid>`)
- the panel edit URL for the page config
- the `cc-qa` verdict
- a plain statement that **production still serves the previous version**, and that publishing is his

If he explicitly asks for a publish in a given session, confirm it back to him first, do only that
action, and do not carry the permission into later tasks.

**Never `yarn publish:page`** — it's DCB boilerplate whose S3 filenames don't match a cc-dynamic build,
so it 404s instead of publishing.

## Orchestration rules

- **One stage at a time; confirm before side-effectful ones** — saving a page config, publishing, and
  posting to a ticket are actions the user should green-light.
- **Never ask for or echo credentials.** Source the user's shell profile (`source ~/.zshrc`) rather
  than requesting keys; never print them.
- **Stop on failure.** A red verify (step 4) or a FAIL in cc-qa (step 7) pauses the pipeline;
  surface it, fix and re-upload, then resume — never publish over a FAIL.
- **Ask, don't invent, for panel required fields.** Especially gateway keys, bank/merchant IDs, MCC,
  and the Google Pay `Merchant Name` (user-visible). The wizard's grey placeholders can belong to a
  *different* merchant — they are not defaults to copy.
- **Resumable.** If the user already did an earlier stage (page exists, project scaffolded), skip
  to the right step rather than restarting.
- Keep the checklist visible and mark stages done as you go.
