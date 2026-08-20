# Templates

Route: `/dynamic-pages/templates/list`. A **Template** is the named build target: the uploaded page
code (client bundle + SSR render) attaches to it, and a dynamic page then points at one of its
versions.

## The one hard rule

**Template name == the git repo name == `.env` `page`.**

The upload script records the build with `template_name: <.env page>`, and `pre:build` aborts unless
`.env` `page` equals the git repo name. So if the template name differs from the repo, the build has
nowhere to land. Get this exactly right, including the trailing tokens
(e.g. `cc-dynamic-streamtrainfit-template-download-nid-gcomp`).

This is *not* the same string as the page name — see `create-page.md`.

## Create a template

Primary path: `create_template` (confirm-first — preview without `confirm:true`, read the Country +
Template Name back to the user, then re-call with `confirm:true`). Browser fallback: Templates list
→ `Create`. Either way you need the **Country** (e.g. `XX`) and the **Template Name** (= repo name)
— a typo means re-uploading under a new template later, so confirm it before committing either path.

A freshly created template has **no versions attached**. That is expected: the build+upload step
(`cc-dynamic-lp`) creates `v1`.

## Template list columns

`Country` · `Template Name` · `Date Created` · `Actions`. Use the **Broad search** box (top right) to
find one by name. Clicking the template name opens
`/dynamic-pages/templates/details/<template_id>` — the numeric id in that URL is the `template_id`
that appears in a page's create payload.

## Details page

**Look up a template — MCP first.** `list_templates` / `get_template` return Country / Template
Name / id; `list_template_versions` returns one template's `ID` / `Version` / `Version Url` /
`Reason` / `Created By` / `Date Created`; `get_template_locales` returns its locale set. Use these
instead of opening `/dynamic-pages/templates/details/<id>` in the browser — fall back to the
browser only if a tool errors. `clear_template_cache` invalidates the panel's cached template list
after a create/update if a fresh read still shows stale data.

### Browser fallback

Header shows Country / Template Name / Date Created, with `Preview` · `Edit` · `Delete` buttons.
Left panel: `Related` (screenshot) and `Details` tabs. Right panel tabs:

| Tab | What it shows |
| --- | --- |
| **Campaigns** | Campaigns bound to this template. |
| **Template Versions** | The uploaded builds — `ID`, `Version`, `Version Url`, `Reason`, `Created By`, `Date Created`. |
| **DYN Unpublished** | Unpublished dynamic pages using this template. |
| **DYN Published** | Published dynamic pages using this template. |

### Verifying an upload landed

After `cc-dynamic-lp`'s build+upload, open **Template Versions** and confirm a row exists whose:

- `Version` is the expected `vN`,
- `Reason` is the git tag message you supplied at upload time,
- `Created By` is you,
- `Version Url` points at
  `https://s3.eu-central-1.amazonaws.com/mobirun/os-ui/static/<page>/html/<vN>_index.html`.

The row's `ID` is the `template_version_id` that goes into the page payload. Cross-check it against
the `id` printed by the upload's `Upload record saved!` output — they must match.

If the tab is empty, the upload did not attach: check that `.env` `page` == repo name == this template
name, and that the upload actually reached `POST /api/v1/upload-template`.

## Versions are additive

Each `build:upload` mints the next `vN` and pushes a matching git tag. Existing pages keep pointing at
the version they were created with — bumping a live page to a new build is an **Edit** on the page
(change Template Version), not something that happens automatically. See `clone-and-update.md`.
