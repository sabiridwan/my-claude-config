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
- run `cc-tester` before publishing.

## Publish

`Actions` → **`Publish`** moves the page from Unpublished to Published — i.e. exposes it to real
traffic. This is the correct publish path for a cc-dynamic credit-card page.

**Do not use the repo's `yarn publish:page`.** It is DCB-flow boilerplate: it builds its S3 keys as
`{country}-{slugify(scenario || strategy_scenariosConfig)}-staging.html` → `-production.html`, but a
cc-dynamic `.env` has no `scenario` and the build uploads `html/staging.html`, `html/index.html`,
`html/v1_index.html`. The names never match, so it 404s instead of promoting anything.

Confirm before clicking, then verify the page now appears in the Published list.

## Edit (update a live config)

`Actions` → `Edit` opens `/dynamic-pages/update/{id}` with the config prefilled and a live preview
pane. Same field map as `create-page.md` — including the traps:

- **Never type in the MCC combobox** (`m.toLowerCase is not a function` crashes the panel and drops
  your unsaved edits). Click to pick.
- Prefilled `celerispay` / `4` in the wallet blocks are *real values*; grey text is a placeholder.
- The `Plan` block is live pricing — read it back before saving.

Common edits: pricing/plan, gateway, titles, images, and **bumping the Template Version** to a newer
build. Version bumps do not happen automatically; a page keeps the version it was created with.

The committing button is **`Update`**. Confirm the field-by-field diff in chat first.

## Clone

`Actions` → `Clone` duplicates a page's config into a new **Unpublished** draft. Use it for "same as
X but for country/product Y".

After cloning, `Edit` the draft and change at minimum:

- **Page Name** — must follow the naming convention and stay unique; a clone's default name will not.
- Country / slug / service / plan / wallet ids — whatever actually differs for the variant.
- **Template Version** if the variant should run a different build.

Cloning creates a new object rather than touching the source page, which makes it the safe way to
derive a variant. Still confirm before clicking `Clone`, and never clone *from* a page the user did
not name.

## Hide / Delete

- `Hide` → moves to the Hidden list (`/dynamic-pages/deleted/list`), pulling it from traffic.
- `Delete` → removes it.

Both are destructive and traffic-affecting. State exactly which page (name + xcid) and what happens,
get an explicit yes, and prefer `Hide` over `Delete` when the user's intent is "take it down".

## Pulling a panel config back into the repo

`yarn pull:config id=<config id>` syncs `config.json` + `.env` from a saved page config. The `id` is
the page config's panel/db id (not the xcid, not the template id). Use it when the panel is the source
of truth and the repo has drifted.
