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
  panel UI operation; it pairs with cc-dynamic-lp (which builds & uploads the page code) but is the
  one to use for anything done inside the panel itself.
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

**Formula**

`{country}-cc-{domain}-{product}-{plan?}-{wallets}-{audience}-{currency}-{creative}-{flag}-dyn`

| Token | Meaning | Examples / notes |
| --- | --- | --- |
| country | Geo | `xx` = generic; `sa`, `th`, `kw` for a specific country. **Exactly one** token. |
| cc | Vertical = credit card | fixed |
| domain | Portfolio / MCC brand the page runs under | `pdfbrain`, `xracademy` |
| product | The service being sold | `streamtrainfit`, `omnilearnhub`, `xrlab360`, `docpilotai` |
| plan | Plan variant | `zerotrial` for the zero-trial page; **omit entirely** for the 0.01 page |
| wallets | Enabled wallets | usually `applepay-googlepay` (or `applepay` / `googlepay`) |
| audience | Traffic type | `acquired` |
| currency | Currency mode | `lc` = local currency |
| creative | Creative type | `download` (or `video`) |
| flag | Comp flag | `gcomp` |
| dyn | Dynamic page | fixed suffix |

**Slug** — carries the acquirer + price and is where **bank + Mid derive from**:
`cc_{acquirer}-{product}portal{price}_{code}-`, e.g. `cc_acquired-xrlab360portal5999_000-`.
(The `portal` segment is not universal — a real live slug is `cc_acquired-streamtrainfit5999_000-`.
Take the slug from the ticket or a sibling page; don't synthesise it.)

**Page names are globally unique — check before you commit to one.** A product often already has a
live page under the conventional name, so the name you derive can be taken. Search **Published,
Unpublished and Hidden** for the product before creating; a clash either fails or silently shadows an
existing page.

When the conventional `{domain}` token collides, **substitute the product for the domain token**
rather than mangling the rest: e.g. `xx-cc-pdfbrain-omnilearnhub-…-dyn` was already live, so the new
page became `xx-cc-omnilearnhub-applepay-googlepay-acquired-lc-download-gcomp-dyn`. Verify the
substitute is free across all three lists, then read it back to the user before creating.

(Watch for the inverse too: a *live* page may carry a defective name — `xcpj0` is
`xx-xx-cc-pdfbrain-streamtrainfit-…` with a duplicated country token — which is precisely why the
correctly-formed name was still available. Don't "fix" an existing page's name; just don't copy it.)

**Validation rules**
- Lowercase, hyphen-separated, ends in `-dyn`.
- **Exactly one country token** — a duplicated `xx-xx-` is the most common defect; flag it.
- A product's two pages differ **only** by the `zerotrial` token.
- Ticket tables often omit the leading country and the `-dyn` suffix; both are added at panel
  creation, so their absence in a ticket is expected, not an error.

**Example — new product "quicknote" under pdfbrain**
- zero-trial: `xx-cc-pdfbrain-quicknote-zerotrial-applepay-googlepay-acquired-lc-download-gcomp-dyn`
- 0.01: `xx-cc-pdfbrain-quicknote-applepay-googlepay-acquired-lc-download-gcomp-dyn`

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
- **QA on staging before publishing.** A newly created page serves at
  `https://staging.mouisys.com/<xcid>` while still Unpublished. Run `cc-tester` there first; `Publish`
  is the step that exposes it to real traffic.
- **Publish via the panel** (`Actions` → `Publish`), never `yarn publish:page` — that script is DCB
  boilerplate whose S3 filenames don't match a cc-dynamic build, so it 404s instead of publishing.
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
