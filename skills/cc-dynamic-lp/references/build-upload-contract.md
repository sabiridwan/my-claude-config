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
- Creates the next `vN` git tag (prompts for a message), `git push origin <vN>`.
- Uploads `dist/static/**` under `os-ui/static/…` (bucket **`mobirun`**, `eu-central-1`, `public-read`;
  HTML `max-age=1`, assets `max-age=604800`).
- Uploads `staging.html` as `os-ui/static/<page>/html/<vN>_index.html`.
- Records it: `POST https://c1.ouisys.com/api/v1/upload-template` with
  `{ env_dump, template_name:page, country, version_url, created_by, git_origin, version:vN, reason }`.

## publish-page.js

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
