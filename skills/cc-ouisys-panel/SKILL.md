---
name: cc-ouisys-panel
description: >-
  Drive the Sam Media / Ouisys panel (panel.ouisys.com) in the browser to CREATE a new dynamic page,
  CLONE an existing page, or UPDATE/EDIT a live page's config. Covers the credit-card (Card Create /
  create-credit-card) flow, the required "create a Template first (named the same as the git repo)"
  step, and the row Actions menu (Clone, Edit, Hide, Delete) on the Published/Unpublished lists. Use
  this whenever someone wants to "create a page in the panel", "clone a page", "duplicate an existing
  page", "edit/update a page config", "change pricing/plan/gateway on a live page", "make a new
  template", "publish/hide a dynamic page", or otherwise operate panel.ouisys.com — even if they only
  say "the panel", "Card Create", "cc page in the panel", or name a page/xcid. This skill owns the
  panel operation; it pairs with cc-dynamic-lp (which builds & uploads the page code) but is the
  one to use for anything done inside the panel itself. It is MCP-FIRST: use the ouisys-panel MCP
  server for every read and every write it supports, and open the panel in the browser only for
  operations the MCP server does not expose yet.
---

# cc-ouisys-panel — operate panel.ouisys.com (create / clone / update)

This skill teaches you to drive the Ouisys panel in the user's own Chrome to create, clone, and
update dynamic pages. The panel is a live production tool: submitting a form creates, changes, or
removes real pages that receive real traffic. So the guiding principle is **navigate and fill freely,
but never click a committing control (Submit, Next→Confirm & Save, Update, Clone, Hide, Delete)
without the user's explicit go-ahead in chat.** You are the hands; the user owns the decision to
commit.

This skill covers the *panel UI* only. The page's actual code (React/SSR project) and its build →
S3 upload is owned by `cc-dynamic-lp`. The two connect through one rule the user cares about:
**a new page needs a Template whose name equals the git repo name** (so the uploaded build lands on
the right template). See "Create a new page" below.

> **Overlaps with `sam-panel-cc-page-creator`.** That skill does the same job but repo-driven: it
> interviews for template + page name, fills the rest from the current repo's `config.json` /
> `brand.config.json` / `.env`, and captures the API ids. Prefer **this** skill when the config values
> come from a ticket or a sibling page (the common case). Don't run both.

## MCP first — never open the browser for something the MCP server can do

The session usually has the **`ouisys-panel` MCP server** (tools named `mcp__ouisys-panel__*`).
It is faster, needs no Chrome login, and is RBAC-gated to the user's own panel role. **Check it
before touching the browser, every time:**

1. Call `whoami` first — it tells you the tools you can use and your role's limits.
2. **All reads go through MCP, never the browser:** `get_dynamic_page`, `search_dynamic_pages`,
   `list_campaigns` / `get_campaign`, `list_mccs`, `list_strategies`, `list_legals`,
   `list_cloaking_presets`, `list_templates` / `get_template` / `list_template_versions` /
   `get_template_locales`, `check_page_name`, `get_card_mcc`. Opening panel.ouisys.com in Chrome
   just to *look something up* is wrong — do that only if the MCP call errors or the field isn't
   in its response.
3. **Safe writes that exist as MCP tools use them:** `clone_campaign`, `create_strategy`,
   `attach_cloaking_preset`, `create_page_config`, `update_page_config`, `create_template`,
   `create_card_mcc`, `update_card_mcc`, `soft_delete_page`, `restore_page`,
   `clear_template_cache`. They are confirm-first: call once without `confirm:true` to preview,
   show the user, then re-call with `confirm:true`. This now covers the Card Create wizard, page
   Edit, Template create, MCC CRUD, and Hide/Restore — drive all of these through the tool, not the
   browser wizard/Actions menu.
4. **The browser is the fallback, not the default.** Fall back to the Chrome workflows below only
   for **Publish** (there is no publish tool — deliberate, see the never-publish-to-production rule
   below) and for anything a tool call errors on or a field its response doesn't cover. The server
   is actively growing: re-check the available `mcp__ouisys-panel__*` tools each session, and when
   a tool now exists for an operation still documented here as browser-only, use it instead.
5. `create_page_config` returns `page_config_id`, `version_id`, and `xcid` on success. If any of
   those is missing from the response in practice, don't guess it — fall back to
   `search_dynamic_pages` / `get_dynamic_page` and read it off the Unpublished row, the same as the
   browser workflow already does.
6. The **read-lag caveat applies to MCP reads too** — see the verification checklist at the bottom:
   `get_dynamic_page` can return a revision older than a write you just made. Baseline guarded
   edits off the form/tool call you just submitted, verify off the served page.

## Prerequisites

- The user's Chrome must be **logged into panel.ouisys.com**. If a screen shows a login page instead
  of the panel chrome (left nav with "Dynamic Pages"), stop and ask the user to log in — do not try
  to authenticate for them.
- Use the Claude-in-Chrome tools. Load them first (they are usually deferred):
  `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__find`
- Always call `tabs_context_mcp{createIfEmpty:true}` once before other browser actions, then work in
  that tab.

## Panel map (Dynamic Pages)

Left nav → Dynamic Pages expands to these routes (memorize; navigating by URL is faster than clicking):

| Item | URL | What it is |
| --- | --- | --- |
| Unpublished | `/dynamic-pages/unpublished/list` | Draft / not-yet-live pages (clones land here) |
| Published | `/dynamic-pages/published/list` | Live pages |
| Hidden | `/dynamic-pages/deleted/list` | Hidden / removed pages (the "Hidden" nav item links here) |
| Templates | `/dynamic-pages/templates/list` | Named templates (build target) |
| Images | `/dynamic-pages/images/list` | Uploaded images |
| Legal Variables | `/dynamic-pages/legal-variables/list` | Legal text variables |
| DCB Create | `/dynamic-pages/create` | New DCB / MSISDN page wizard |
| **Card Create** | `/dynamic-pages/create-credit-card` | **New credit-card page wizard** |

Each list row has an **Actions** dropdown (Preview, View Details, **Edit**, **Clone**, **Publish**,
**Hide**, **Delete**). Lists support a **Broad search** box (top right) — the fastest way to
find a page by name or xcid. Edit opens `/dynamic-pages/update/{id}`.

Two things that will otherwise cost you time:

- **The Actions menu renders in a portal** — after clicking `Actions` a screenshot may show nothing.
  `find` the menu item and click it by `ref`. Clicking a page name or `Quick Preview` frequently does
  not navigate, and `View Details` can silently do nothing; use `Actions` → `Preview`.
- **`Actions` → `Preview` opens `https://staging.mouisys.com/<xcid>`** — the real build with the real
  config, and it works while the page is still **Unpublished**. This is where you QA a new page
  *before* exposing it to traffic.

## The three workflows

Pick the reference for the task and follow it step by step. Read the reference file before acting so
you use the exact field names and don't miss a required field.

1. **Create a new page** → `references/create-page.md`. Two prerequisites first: (a) a Template
   exists whose name equals the git repo, and (b) the page's build has been uploaded to it (via
   `cc-dynamic-lp`). Then the Card Create wizard registers the page config. If the template is
   missing, create it first (`references/templates.md`).

2. **Clone an existing page** → `references/clone-and-update.md`. Row Actions → Clone duplicates a
   page's config into a new draft (Unpublished) that you then rename/adjust. Use this when the user
   wants "a copy of page X" or "same as X but for country/product Y".

3. **Update / edit a live page** → `references/clone-and-update.md`. Row Actions → Edit opens
   `/dynamic-pages/update/{id}` with the config prefilled and a live preview. Change fields, then the
   user confirms before you click **Update**. Use for pricing/plan, gateway, titles, images, template
   version bumps, etc.

## Page naming convention (credit-card)

Every credit-card page name is built from ordered, hyphen-separated tokens. Use this to generate a
new name, validate an existing one, or derive a sibling page. **Page name = template name = git repo
name**, so getting it right matters for the build to attach.

> **Page name and template name are DIFFERENT strings.** Only the *template* name must equal the git
> repo name (== `.env` `page`) for the build to attach. The *page* name follows the formula below and
> is its own value — e.g. page
> `xx-cc-pdfbrain-streamtrainfit-applepay-googlepay-acquired-lc-download-gcomp-dyn` on template
> `cc-dynamic-streamtrainfit-template-download-nid-gcomp`. Verified working; don't force them equal.
> (That live name predates the `{bank}` token — read it as an illustration of the *page ≠ template*
> point, not as a name to copy.)

**Formula**

`{country}-cc-{bank}-{domain}-{product}-{plan?}-{wallets}-{audience}-{currency}-{creative}-{flag}-dyn`

| Token | Meaning | Examples / notes |
| --- | --- | --- |
| country | Geo | `xx` = generic; `sa`, `th`, `kw` for a specific country. **Exactly one** token. |
| cc | Vertical = credit card | fixed |
| bank | **Acquiring bank**, short lowercase token | Comes from the ticket's Bank name field (`cc-lp-request` A5 / Block B), *not* from the numeric Bank ID — the ID only ever lands in `payments.*.bankId`. Required on every new page; see the note below. |
| domain | Portfolio / MCC brand the page runs under | `pdfbrain`, `xracademy` |
| product | The service being sold | `streamtrainfit`, `omnilearnhub`, `xrlab360`, `docpilotai` |
| plan | Plan variant | `zerotrial` for the zero-trial page; **omit entirely** for the 0.01 page. **One-off (`plan.type: 'one-off'`) pages have no observed token yet** — no shipped page name in any harvested repo uses one. Don't invent a token (e.g. `oneoff`); ask the user for a sibling one-off page name, or flag it as an open question in the ticket-analysis report rather than guessing. |
| wallets | Enabled wallets | usually `applepay-googlepay` (or `applepay` / `googlepay`) |
| audience | Traffic type | `acquired` |
| currency | Currency mode | `lc` = local currency |
| creative | Creative type | `download` (or `video`) |
| flag | Comp flag | `gcomp` |
| dyn | Dynamic page | fixed suffix |

**The `{bank}` token is new — existing live names mostly don't have it.** The slot immediately after
`cc` has historically been filled ad-hoc: some shipped pages put a portfolio/vertical word there
(`xx-cc-xr-vreducationlab-xracademy-…`, `xx-cc-stream-rewatchtvplus-…`,
`xx-cc-fitness-econtent-xracademy-…`), and the most recent ones skip it entirely
(`xx-cc-smartpdfdesk-resumetuneai-acipxp-download-gcomp-dyn`). From now on that slot is the **bank**.

Consequences worth being deliberate about:

- **Never rename a live page** to add the token. Page names are the `env.page` value baked into the
  build and are what the panel lists; renaming buys nothing and risks breaking the attach. Old names
  stay as they are.
- **A sibling page is no longer a naming template.** Deriving a new name by copying a sibling and
  swapping the product will drop the bank token or inherit a stale vertical word. Build the name from
  the formula, then check uniqueness.
- **A missing bank name is a blocker, not a guess.** Don't infer the bank from the gateway — they are
  different things (gateway `aci-pxp`, `celeris`, `maxpay`, `acquired` is the PSP; the bank is the
  acquirer behind it) and one gateway serves several banks. If the ticket carries only a numeric Bank
  ID, ask for the name rather than inventing a token from the number.

**Slug** — carries the acquirer + price and is where **bank + Mid derive from**:
`cc_{acquirer}-{product}portal{price}_{code}-`, e.g. `cc_acquired-xrlab360portal5999_000-`.
(The `portal` segment is not universal — a real live slug is `cc_acquired-streamtrainfit5999_000-`.
Take the slug from the ticket or a sibling page; don't synthesise it.)

The trailing `_{code}-` (e.g. `_000-`, `_001-`) is not documented anywhere and is not universal —
some older slugs have no trailing code at all (`cc_maxpay-entertainu50-` before a 2026-07-23 fix
added `_001-`). Treat it as a per-page/MID sequence number, not a constant: **when a ticket lists
several MIDs for one product, expect a distinct slug (and likely a distinct code) per MID** — ask
for or confirm the exact slug per row rather than reusing one slug's code across all of them.

**Page names are globally unique — check before you commit to one.** A product often already has a
live page under the conventional name, so the name you derive can be taken. Search **Published,
Unpublished and Hidden** for the product before creating; a clash either fails or silently shadows an
existing page.

When the conventional `{domain}` token collides, **substitute the product for the domain token**
rather than mangling the rest: e.g. `xx-cc-pdfbrain-omnilearnhub-…-dyn` was already live, so the new
page became `xx-cc-omnilearnhub-applepay-googlepay-acquired-lc-download-gcomp-dyn`. Verify the
substitute is free across all three lists, then read it back to the user before creating. (Those two
names are pre-`{bank}`; today the same collision would be resolved between
`xx-cc-{bank}-pdfbrain-omnilearnhub-…` and `xx-cc-{bank}-omnilearnhub-…`. Note the bank token often
makes the collision disappear on its own — check the full new name before reaching for the
substitution.)

(Watch for the inverse too: a *live* page may carry a defective name — `xcpj0` is
`xx-xx-cc-pdfbrain-streamtrainfit-…` with a duplicated country token — which is precisely why the
correctly-formed name was still available. Don't "fix" an existing page's name; just don't copy it.)

**Validation rules**
- Lowercase, hyphen-separated, ends in `-dyn`.
- **Exactly one country token** — a duplicated `xx-xx-` is the most common defect; flag it.
- **Bank token present, and it is a bank** — not the gateway repeated, not the numeric Bank ID. A new
  name without it is incomplete; an *existing* name without it is legacy and left alone.
- A product's two pages differ **only** by the `zerotrial` token.
- Ticket tables often omit the leading country and the `-dyn` suffix; both are added at panel
  creation, so their absence in a ticket is expected, not an error.

**Example — new product "quicknote" under pdfbrain, bank `pxp`**
- zero-trial: `xx-cc-pxp-pdfbrain-quicknote-zerotrial-applepay-googlepay-acquired-lc-download-gcomp-dyn`
- 0.01: `xx-cc-pxp-pdfbrain-quicknote-applepay-googlepay-acquired-lc-download-gcomp-dyn`

When creating pages from a ticket, generate the name from this formula, validate it against these
rules, and read it back to the user before creating.

## Safety rules (non-negotiable)

- **Confirm before committing.** Before clicking Submit, Next → Confirm & Save, Update, Clone, Hide,
  or Delete, summarize exactly what will happen (which page, which fields, live vs. draft) and get a
  clear "yes" in chat. Delete and Hide affect live traffic — treat them with extra care.
- **Never guess required fields.** Fields marked `*` are required. If you don't have a value, ask;
  don't invent one (especially gateway keys, bank/merchant IDs, MCC, prices). Note the wizard's grey
  placeholder text often looks like a real value (`AGDS030924001`, `BCR2DN4T6O6NPIB5`,
  `Prizeflix B.V.`) — it is **not** a value, and some of it belongs to a *different* merchant.
  Conversely `celerispay` / `4` in the wallet blocks are **prefilled real values** that will save
  as-is unless you overwrite them.
- **NEVER type into the MCC combobox.** Its search filter throws
  `m.toLowerCase is not a function`, which crashes the panel to a blank "Something went wrong" screen
  and **loses every field you had filled**. Click it open and pick from the list instead. Select the
  MCC early, since it survives refilling the rest.
- **A credit-card page needs a template that already has an uploaded build version.** `Template
  Version` is required and lists only what's been uploaded. So the real order is: create Template →
  scaffold → build+upload (`v1`) → *then* create the page. Don't start the wizard before that.
- **NEVER PUBLISH TO PRODUCTION — this is a hard stop, not a preference.** Standing instruction from
  the repo owner (2026-08-16) covering every credit-card task: do NOT click `Actions` → `Publish`,
  do NOT promote a campaign's `staging_template_version` to `published_template_version`, and do NOT
  run any publish command. He does that step manually. Creating/cloning/editing a page config and
  leaving it Unpublished or in `staging` status is the deliverable — stop there, hand back the panel
  URL, and state plainly that production still serves the old version. Never frame publishing as the
  natural last step you can take for him; it is his decision, because these pages front live paid
  traffic taking real card payments. If he explicitly asks for a publish in a given session, confirm
  it back first, do only that action, and do not carry the permission forward.
- **QA on staging before publishing.** A newly created page serves at
  `https://staging.mouisys.com/<xcid>` while still Unpublished. Run `cc-qa` there — that is where
  your work ends. `Publish` is the step that exposes it to real traffic, and it is his to make.
- **If a publish ever is explicitly authorized, it goes via the panel** (`Actions` → `Publish`),
  never `yarn publish:page` — that script is DCB boilerplate whose S3 filenames don't match a
  cc-dynamic build, so it 404s instead of publishing.
- **Prices come from the panel plan config.** The Plan section (Full Price, Trial Price, Currency,
  Trial Days, Billing Cycle, Is Local Currency) is the source of truth for pricing. Set it
  deliberately and read it back to the user before saving.
- **Page Name = template name = git repo name.** Keep these identical or the build won't attach and
  the upload `pre:build` check fails. See `cc-dynamic-lp` for the code side.
- **Don't authenticate, accept terms, or change account/admin settings** on the user's behalf. If the
  panel is logged out, ask the user to log in.
- **Verify after committing.** After a save, re-open the page (search by name/xcid) or use Quick
  Preview / "Open in new tab" to confirm the change landed, and report back what you saw.

## Verification checklist (end of any task)

Before telling the user you're done, confirm: the page appears in the expected list
(Unpublished for a new/cloned draft, Published for a live edit), the key fields match what was asked
(name, slug, service, gateway, plan/pricing, template version), and the preview renders. Report the
page name, its xcid if shown, and the list it's in.

**The read API can lag the write you just made.** `get_dynamic_page` (and equivalent panel reads)
can return an older revision than what the form just saved — seen twice independently: once
reporting a stale `paymentMethods` list right after a same-session edit, once reporting a page's
config a version behind its already-served bundle. Baseline any guarded edit off the FORM you just
submitted, not a fresh API read, and verify the actual effect off the served/staging page, not a
second panel read.
