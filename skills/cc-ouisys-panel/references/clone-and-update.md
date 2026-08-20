# Clone / update / publish an existing page

All of these start from a row's **`Actions`** dropdown on a Dynamic Pages list
(`/dynamic-pages/unpublished/list`, `/published/list`, `/deleted/list`).

Menu items: `Preview` · `View Details` · `Edit` · `Clone` · `Publish` · `Hide` · `Delete`.

> **The `Actions` menu renders in a portal.** After clicking `Actions`, a screenshot may show no menu
> at all. Use `find` for the item you want and click it by `ref`. Likewise, clicking a page name or
> `Quick Preview` in the list often does not navigate, and `View Details` can silently do nothing —
> prefer `Actions` → `Preview`.

Find the row first with the **Broad search** box (top right); it matches page name and xcid.

## Safety ordering for anything on a live page

1. `Preview` it and snapshot `window.configJson.pageConfigs` **before** changing anything, so you can
   describe and if necessary reverse the change.
2. Make the edit, read the diff back to the user in chat.
3. Only then click the committing button.
4. Re-`Preview` and confirm the change actually landed.

`Hide` and `Delete` affect live traffic. Never run them without an explicit, specific yes — and per
the standing project rule, **do not modify existing pages at all** unless the user asked for that
page by name.

## Preview

Opens **`https://staging.mouisys.com/<xcid>`** in a new tab — the real build with the real config.
Works for Unpublished pages too, which is what makes pre-publish QA possible. Read-only and safe.

Use it to:
- snapshot the live config (`window.configJson.pageConfigs`),
- confirm which payment tabs render (this is decided in code, not config),
- run `cc-qa` before publishing.

## Publish

`Actions` → **`Publish`** moves the page from Unpublished to Published — i.e. exposes it to real
traffic. This is the correct publish path for a cc-dynamic credit-card page.

There is no MCP publish tool, and none should be added or wired in for this — Publish is
deliberately human/browser-only, per the never-publish-to-production rule (`cc-ouisys-panel/SKILL.md`
and `cc-launch` step 8).

**Do not use the repo's `yarn publish:page`.** It is DCB-flow boilerplate: it builds its S3 keys as
`{country}-{slugify(scenario || strategy_scenariosConfig)}-staging.html` → `-production.html`, but a
cc-dynamic `.env` has no `scenario` and the build uploads `html/staging.html`, `html/index.html`,
`html/v1_index.html`. The names never match, so it 404s instead of promoting anything.

Confirm before clicking, then verify the page now appears in the Published list.

## Edit (update a live config)

Primary path: `update_page_config`, confirm-first (preview without `confirm:true`, read the
field-by-field diff back to the user, then re-call with `confirm:true`). Browser fallback —
`Actions` → `Edit` opens `/dynamic-pages/update/{id}` with the config prefilled and a live preview
pane, useful if you need the visual preview pane itself. Same field map as `create-page.md` either
way — including the traps:

- **Never type in the MCC combobox** (`m.toLowerCase is not a function` crashes the panel and drops
  your unsaved edits). Click to pick.
- Prefilled `celerispay` / `4` in the wallet blocks are *real values*; grey text is a placeholder.
- The `Plan` block is live pricing — read it back before saving.
- **`Plan Type` is part of that block.** Changing a price does not change how the page bills. If the
  variant is a single charge rather than a subscription, switch Plan Type to `one-off` too, or the
  page keeps advertising auto-renewal at the new price.

Common edits: pricing/plan, gateway, titles, images, and **bumping the Template Version** to a newer
build. Version bumps do not happen automatically; a page keeps the version it was created with.

The committing button is **`Update`**. Confirm the field-by-field diff in chat first.

## Clone

There is no dedicated MCP clone tool for a *page* (that's different from the existing
`clone_campaign`, which clones a Campaign object, not a Dynamic Page). Primary path: read the
source page's full config with `get_dynamic_page`, then call `create_page_config` (confirm-first)
with that config as the base and the fields below changed. Browser fallback — `Actions` → `Clone`
duplicates a page's config into a new **Unpublished** draft directly. Use either for "same as X but
for country/product Y".

After cloning, `Edit` the draft and change at minimum:

- **Page Name** — must follow the naming convention and stay unique; a clone's default name will not.
- Country / slug / service / plan / wallet ids — whatever actually differs for the variant.
- **Template Version** if the variant should run a different build.

**Clone-and-change-pricing is the normal shape of a multi-product ticket.** When a ticket's table
lists several slugs against one design, that is one page built once and cloned per row — the rows are
page *configuration*, not separate builds.

When you do that, `Plan Type` is a per-row decision, not something inherited. A ticket table with a
`One Off` column is telling you the type per slug: `Yes` → `one-off`, `No — subscription (trial X → Y)`
→ `trial-then-subscription`. Clone carries the source page's Plan Type, so a one-off cloned from a
trial page stays a trial page until you change it — and then advertises a renewal that will never
happen. Read the type back per clone alongside the price.

Cloning creates a new object rather than touching the source page, which makes it the safe way to
derive a variant. Still confirm before clicking `Clone`, and never clone *from* a page the user did
not name.

## Hide / Restore / Delete

- **Hide** — primary path `soft_delete_page` (confirm-first); moves the page to the Hidden list
  (`/dynamic-pages/deleted/list`), pulling it from traffic. Browser fallback: `Actions` → `Hide`.
- **Restore** — primary path `restore_page` (confirm-first); moves it back out of Hidden.
- **Delete** (hard delete) — no MCP tool exposes this yet; browser only: `Actions` → `Delete`.

Hide and Delete are both destructive/traffic-affecting. State exactly which page (name + xcid) and
what happens, get an explicit yes, and prefer `Hide`/`soft_delete_page` over a hard `Delete` when
the user's intent is "take it down" — it's reversible via `restore_page`.

## Pulling a panel config back into the repo

`yarn pull:config id=<config id>` syncs `config.json` + `.env` from a saved page config. The `id` is
the page config's panel/db id (not the xcid, not the template id). Use it when the panel is the source
of truth and the repo has drifted.
