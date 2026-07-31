# Build → upload → publish contract (Ouisys panel)

The exact pipeline a cc-dynamic page must satisfy to be uploadable and live via the panel. Extracted
from `ouisys-clients/dist/dev-tools/*` and the reference project scripts.

## npm scripts (package.json)

| Script | Runs | Purpose |
| --- | --- | --- |
| `manage:configs` | `configure-test-page-dynamic-template.js` | Local server on :5007; opens `panel.ouisys.com/configs/strategies/manage`; panel POSTs config to `localhost:5007/submit-form`; writes `config.json` + `.env`. |
| `pull:config` | `pull-config.js` | `GET c1.ouisys.com/api/v2/get-single-page-config?id=<id>` → writes `config.json` (`page_config_dump`) and `.env` (`pageConfigs.env`). |
| `pre:build` | `pre-build-dynamic.js` | Validates + writes `.env`. **Aborts unless `page` === git repo name** (or `abtest/<page>` branch). Skipped check when `SKIPCHECKS=true`. |
| `build` | `pre:build` + prod webpack | Client bundle → `dist/static/<page>/…`. |
| `build:ssr` | ssr webpack | Node bundle `dist/static/<page>/ssr/main.js`. |
| `build:ssr:server` | `node ssr-dynamic.js` | Renders `Root` to `staging.html`. |
| `build:ssr:all` | clean + build + build:ssr + build:ssr:server | Full production render. |
| `build:upload` | `build:ssr:all` (publicPath=/os-ui, SKIPCHECKS=true) + `upload-to-s3-tagged.js` | Upload to S3 + record. |
| `publish:page` | `publish-page.js` | Promote staging→prod on S3 + release. |

## .env schema

```
client=super-strategy        # cosmetic label
title=Home Page              # <title>
page=<repo-name>             # MUST equal the git repo name; drives all S3 key paths
country=xx                   # xx = dynamic; real country from URL at runtime
strategy=credit-card
scenariosConfig=xx-creditcard-<service>
defaultScenario=xx-creditcard-<service>
defaultService=<serviceId>
```

Credentials come from the shell env, not `.env`: `osui_aws_access_key_id`, `osui_secret_access_key`
(S3 `eu-central-1`), and flags `SKIPCHECKS`, `TNC`, `publicPath=/os-ui`.

## config.json

```json
{
  "strategy": "credit-card",
  "country": "xx",
  "strategyConfigs": {
    "default": {
      "flow": "creditCard",
      "flowConfig": { "host": "", "slug": "<billing-slug>", "device": "smart",
                      "country": "xx", "service": "<serviceId>",
                      "operators": null, "automaticallySubmitAllOperators": false }
    },
    "operators": {}
  }
}
```

At runtime the live config is `window.configJson.pageConfigs` (injected by the backend / panel);
`config.json` is the static fallback. `pageConfigs` carries `plan` (prices), `payments` (bankIds,
wallet config), `service`, `slug`, `flags`, `env` — this is what `cc-payment-integration` reads.

## upload-to-s3-tagged.js

- Refuses to run with uncommitted changes (`git status --porcelain`).
- Creates the next `vN` git tag (prompts for a message — **empty is rejected and re-prompts forever**),
  `git push origin <vN>`.
- **Prompts via inquirer in raw mode → cannot be piped.** `printf '\n\n…' |` gets swallowed by the
  first prompt then dies `SIGINT`; `yes "" |` loops on the tag prompt. Drive with `expect` (script in
  the parent SKILL.md).
- Needs `osui_aws_access_key_id` / `osui_secret_access_key` exported. In `~/.zshrc`, which a
  non-login shell does not source — `source ~/.zshrc` first.
- Requires Node per `.nvmrc` (**v20.12.2**); Node 21+ breaks `ssr-dynamic.js` on read-only
  `global.navigator`.
- On success prints `Upload record saved!` with `{ id, version, version_url, reason, template_id,
  created_by }` — `id` is the `template_version_id` the panel wizard will reference.
- Uploads `dist/static/**` under `os-ui/static/…` (bucket **`mobirun`**, `eu-central-1`, `public-read`;
  HTML `max-age=1`, assets `max-age=604800`).
- Uploads `staging.html` as `os-ui/static/<page>/html/<vN>_index.html`.
- Records it: `POST https://c1.ouisys.com/api/v1/upload-template` with
  `{ env_dump, template_name:page, country, version_url, created_by, git_origin, version:vN, reason }`.

## publish-page.js — DOES NOT WORK for cc-dynamic pages

**Do not use `yarn publish:page` to publish a credit-card page.** Publish via the panel instead:
row `Actions` → `Publish` (see `cc-ouisys-panel`).

Why it fails here: it looks for `<country>-<slug>-staging.html`, where
`slug = slugify(scenario || "${strategy}_${scenariosConfig}")`. A cc-dynamic `.env` has **no
`scenario`**, and `build:upload` uploads `html/staging.html`, `html/index.html`, `html/v1_index.html`
— never a `<country>-<slug>-staging.html`. So the `headObject` check 404s and nothing is promoted.
It is boilerplate inherited from the DCB flow. Kept documented below for reference only.

- `slug = slugify(scenario || `${strategy}_${scenariosConfig}`)`.
- On S3: copies `<country>-<slug>-staging.html` → `<country>-<slug>-production.html` (backs up existing prod).
- `GET https://c1.ouisys.com/api/v1/get-page?page&country&scenario=<slug>&strategy&scenarios_config`
  → `data.id`.
- `POST https://c1.ouisys.com/api/v1/release-page` `{ html_url, page_upload_id:data.id, username }`.
- Prints `http://c1.ouisys.com/preview/?country=<country>&page=<page>&scenario=<slug>`.

## Page identifiers

- `page` (.env) — human id; == git repo name; all S3 paths `os-ui/static/<page>/html/`.
- config `id` — panel/db id of a saved page config; used by `pull:config`.
- `page_upload_id` — backend id from `get-page`, passed to `release-page`.
- slug — derived, used in filenames + preview URL.
- `xcid`/`xid` — not used by the active upload flow (only in a commented-out create-campaign block).

## What a green `verify.mjs` guarantees — and does not

Guarantees: correct structure, `.env`/`config.json` shape, required build files present, branding
applied, payment core present + type-checks, checkout wired. It does **not** run the private webpack
build (needs `ouisys-clients` + auth) or touch S3/panel. The real `build:upload` / `publish:page`
must run in the team's authenticated environment.
