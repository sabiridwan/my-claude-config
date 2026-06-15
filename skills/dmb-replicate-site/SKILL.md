---
name: dmb-replicate-site
description: Use when asked to replicate, clone, copy, match, or migrate an existing live website (given a reference URL or v1 domain) into a v2 bespoke portfolio under sites/ in the dmb-portfolios repo. Triggers on "make a portfolio like <url>", "replicate this site", "match this design / theme", "clone <domain>", "use all the images", "migrate <domain> to v2 as exact copy".
---

# DMB Replicate Site → v2 Portfolio

## Overview

Faithfully reproduce a live reference website as a bespoke **v2** site under `sites/<name>/` in `dmb-portfolios`: same theme (colors/fonts), same section structure, same copy, the site's **own downloaded images** — while keeping the v2 plumbing (Notion-driven pricing/legals/forms).

**This is for the site OWNER replicating their own product** into their portfolio framework. Pull the real assets and match the design; don't approximate.

**Required reading in-repo:** `sites/AI-PORTFOLIO-GUIDE.md` (page contract) and `sites/README.md` (mechanics). This skill adds the *reference-replication* layer on top.

---

## The mistake to avoid

The #1 failure: **cloning another portfolio (e.g. topgame2play) instead of the reference.** A cloned gaming portfolio with a cyan theme is "not in any way similar" to a green esports brand. Build **bespoke from the reference**, not by copying another `sites/*` folder.

---

## Phase 1 — Recon the reference

```bash
# Render in a REAL browser (most product sites are JS SPAs — curl returns a loading shell)
# Playwright: navigate → full-page screenshot. Study every section, order, palette, copy.
```

Then pull the source for deterministic extraction (browser UA beats bot-blocking):

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -s -A "$UA" "<REF_URL>" -o /tmp/ref/page.html
grep -oE 'href="[^"]+\.css[^"]*"' /tmp/ref/page.html      # find compiled CSS
grep -oiE 'fonts.googleapis.com[^"]*'  /tmp/ref/page.html  # fonts
```

**Extract design tokens from the compiled CSS** (don't eyeball-guess):
```bash
curl -s -A "$UA" "<REF_ORIGIN>/<hash>.css" -o /tmp/ref/app.css
grep -oiE "#[0-9a-f]{6}" /tmp/ref/app.css | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn | head   # accent + bg colors
grep -oiE "font-family:[^;}]*" /tmp/ref/app.css | sort -u                                       # fonts
```
The most-used non-white/non-black hex is usually the accent. Note the heading font (e.g. `League Spartan`).

**Find the site's own images** — SPAs reference them in the JS bundle, not the HTML:
```bash
grep -oE 'src="/assets/[^"]+\.js"' /tmp/ref/page.html        # find bundle
curl -s -A "$UA" "<REF_ORIGIN>/<bundle>.js" -o /tmp/ref/app.js
grep -oE '/images/[A-Za-z0-9_./-]+\.(png|jpe?g|webp|svg)' /tmp/ref/app.js | sort -u
```

## Phase 2 — Download the real images

```bash
for n in hero-1 hero-2 background platform rainbow-1 ...; do
  curl -s -A "$UA" "<REF_ORIGIN>/images/$n.png" -o sites/<name>/assets/img/$n.png
done
```
Then **VIEW each image** (Read tool) to map it to its section — names lie (`hero-3` may be the actual hero bg; `hero-1` a CTA image). Note which is the hero background, channel cards, character art, logo wordmark.

## Phase 3 — Map the Notion config to decisions

```bash
node -e "const s=JSON.parse(require('fs').readFileSync('.tmp/notion-snapshot.json','utf8'));const c=s.find(x=>x.domain==='<domain>');console.log(JSON.stringify({business_type:c.business_type,languages:c.languages,landing:c.landing_page,care_email:c.customer_care_email,mcc:c.company?.mcc,connections:c.connections},null,1))"
```
| Config | Decides |
|---|---|
| `business_type: creditcard` | email signin · ccterms (auto) · NO carrier-billing |
| `business_type: content` | phone signin · carrier-billing page · per-operator opt-out |
| `languages` | which `locales/<lang>.js` files (all must be fully written) |
| `connections` | pricing card(s): loop `site.connections`, never hardcode price |
| `landing_page` | subscribe CTAs → `/lp/<landing>` |

Domain must be in Notion with **Status = Build** or the build fails.

## Phase 4 — Build bespoke (mirror pdfbrain, not topgame2play)

Wipe any clone (`rm -rf sites/<name>/_includes` and wrong images). Then write:

| File | Holds |
|---|---|
| `assets/css/<name>.css` | `:root` tokens (accent, bg, surface, line, radius, font) → ALL section styles |
| `_includes/layouts/base.html` | font `<link>`, header nav, `{{ content }}`, footer include, **JS** (below) |
| `_includes/footer.html` | columns + obfuscated `{{ site.mcc \| obfuscate }}` / `{{ site.address \| obfuscate }}` + care email + legal links |
| `index.html` | every reference section, in order, `{{ t.* }}` driven |
| `locales/<lang>.js` | `module.exports = (site) => ({...})` — all copy (original, faithful to the brand's messaging) |
| `terms/privacy-policies/cookies.html` | thin wrappers: `{% include 'terms.html' %}` etc. (shared legals) |
| `about/pricing/contact/signin/unsubscribe-refund/404.html` | themed; pricing loops `site.connections` |

**base.html MUST include** (copy from an existing bespoke site): the `cls-int` data-hex decoder (else MCC/address render blank), the `html.js` reveal gate + IntersectionObserver, and the `http`/`helper` form globals.

## Phase 5 — Build, verify, commit

```bash
npm run build <name>                 # → _site/<domain>/<lang>/
# screenshot the build in a browser and compare side-by-side with the reference
npm test                             # 24/24
git add sites/<name> _site/<domain> && git commit -m "feat(<name>): ..."
```
Verify: every section present, all images load, pricing shows the Notion price, legals render, no blank entity. Delete review screenshots before committing.

---

## Gotchas (every one cost real time)

| Symptom | Cause / fix |
|---|---|
| `t.*` all blank, `<main>` nearly empty | **stale build output** — rebuild and re-grep; don't trust the first read |
| A page silently reverts to an old version mid-edit | editor/linter restored a prior copy — **use the Write tool (not heredoc), re-Read, re-verify**; heredoc writes can get reverted |
| `<!--DBG-->` comment never appears in output | htmlmin `removeComments:true` strips comments — debug with a **visible** `<p id=DBG>` |
| Price/operator fields blank but `site.connections[0].price` works | the *page file reverted* to an old template using different vars — re-check the actual file content |
| Company name / address blank on the page | the `cls-int` decoder script is missing from base.html — add it |
| Content invisible without JS | reveal styling not gated — hide only under `html.js .reveal` |
| `curl` returns a tiny loading shell | it's a JS SPA — use the browser to render, or read the JS bundle for content/images |
| `Browser is already in use ... mcp-chrome-...` | `pkill -9 -f ms-playwright-mcp; rm -rf ~/Library/Caches/ms-playwright-mcp/mcp-chrome-*` then re-navigate |
| `No Notion portfolio with Status=Build` | domain missing/misspelled in `site.config.js`, or not Status=Build (the real reason prints earlier as "Invalid portfolio skipped") |

## Migrating a v1 domain (exact copy, not a redesign)

If the ask is "migrate `<domain>` to v2 as an exact copy" (not match a new design): recover/port the v1 templates with a site-local `setup.liquid` mapping v1's `pair`/`i18n-setup` vars onto v2 globals (`t`/`legals`/`site`), copy the v1 theme CSS + images verbatim, and verify **rendered-text parity** (normalize tags→text, diff vs the live site, expect ~1.0 similarity). Residual diffs are usually Cloudflare email obfuscation and entity obfuscation (decodes to identical values) — not real gaps.

## Operational reminder

If the domain is still in v1's Notion build set, `build:v1`/`build:prod` overwrites the output — re-run `npm run build <name>` until it's removed from v1.
