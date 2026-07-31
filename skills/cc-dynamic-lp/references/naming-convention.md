# cc-dynamic LP naming convention

The project name is load-bearing: it is simultaneously the **folder name**, the **`.env` `page`**,
and the **git repo name** — and `pre:build` aborts the upload unless `page === git repo name`. So the
scaffold derives one canonical name and uses it everywhere.

## Pattern

```
cc-dynamic-<service>-template[-<creative>][-nid]-gcomp
```

- `cc-dynamic-` — fixed prefix for dynamic credit-card landing pages.
- `<service>` — the product/service id, lowercase, no separators (e.g. `streamtrainfit`,
  `omnilearnhub`, `xrlab360`, `pdfbrain`, `xracademy`). The generic base templates use the literal
  `template` here (no service).
- `<creative>` — the non-comp creative, when present: `download` or `video`. Omit for comp-only pages.
- `nid` — the NID variant flag. Included by default for the gcomp templates; drop it with
  `"nid": false` when a page is not the NID variant.
- `gcomp` — the Google comp/non-comp variant (card + Apple Pay + Google Pay with the comp gate). This
  is the default suffix; override with `"suffix": "…"` only for a different variant.

All lowercase, hyphen-separated. Validated against `^[a-z0-9][a-z0-9-]*$`.

## Examples (derived from requirements)

| Requirements | Derived name |
| --- | --- |
| service `streamtrainfit`, creative `download`, nid | `cc-dynamic-streamtrainfit-template-download-nid-gcomp` |
| service `omnilearnhub`, comp-only (creative `none`), nid | `cc-dynamic-omnilearnhub-template-nid-gcomp` |
| service `xrlab360`, creative `video`, nid | `cc-dynamic-xrlab360-template-video-nid-gcomp` |
| service `docpilotai`, comp-only, no nid (`"nid": false`) | `cc-dynamic-docpilotai-template-gcomp` |

These mirror the existing repos (`cc-dynamic-pdfbrain-template-...-gcomp`,
`cc-dynamic-xracademy-template-gcomp`, `cc-dynamic-vreducationlab-template-gcomp`, etc.).

## How the scaffold picks the name

1. If `product.json` sets `productName`, that is used verbatim (still validated).
2. Otherwise it is derived from `serviceId` + `creative` + `nid` + `suffix` per the pattern above.

Override inputs in `product.json`: `productName`, `creative` (`none|download|video`), `nid`
(`true|false`), `suffix` (default `gcomp`).

## Location & git remote (fixed defaults)

- **Location:** the project is created at `<cc-template>/<name>` (the `cc-template` dir alongside the
  other templates). Override with `--cc-template-dir` or `--out`.
- **Git remote:** `origin` is set to
  `git@git.sam-media.com:ouisys/dynamic-templates/xx/<name>.git`
  (HTTPS equivalent: `https://git.sam-media.com/ouisys/dynamic-templates/xx/<name>.git`).
  Override the group with `--git-remote-base`; skip git entirely with `--no-git`.

Because the remote repo name equals `<name>` equals `.env page`, the upload `pre:build` check passes.

## Related conventions

The generic strategies repos use a different, older pattern documented in each template README —
`{country}-{service}-{theme}-strategies`, with `-test-<kind>` for tests and `-email` (cloak) /
`-cmp` (compliant) suffixes. That applies to the classic strategy repos; **cc-dynamic LP pages use
the `cc-dynamic-…-gcomp` pattern above.**
