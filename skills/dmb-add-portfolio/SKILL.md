---
name: dmb-add-portfolio
description: Use when adding a new content template or vertical to the dmb-portfolios 11ty project. Triggers on "add new portfolio", "create new content type", "new vertical", "new product template" for this repo.
---

# DMB Add Portfolio

## Overview

Automates the full process of adding a new content template/vertical to `dmb-portfolios`. Given a template name and product description, this skill scaffolds all required files and wires up every config entry.

**Repo:** `dmb-portfolios` (11ty static site generator)
**Reference spec:** https://app.notion.com/p/sammedia/Portfolio-Add-New-199a5b097ae8801d84b5d3b7d8870fd0

---

## Inputs — Collect Before Starting

Ask the user for these if not provided:

| Input | Example | Notes |
|---|---|---|
| `name` | `music`, `astrology`, `cooking` | kebab-case, used as folder name and filter key |
| `productDescription` | "AI-powered music streaming service" | 1–2 sentences describing the product |
| `languages` | `en,es,fr,nl,tr` | Comma-separated. See Language Sets below |
| `colorTheme` | `#071330,#0f2d6e,#00c8ff` | `bg1,bg2,accent` for image generation |

**Language Sets (pick one or customize):**
- **Minimal:** `en,es,fr,nl,sl,tr` (same as pdfbrain-ai)
- **Standard:** `en,ar,de,fr,es,it,nl,pl,pt,sl,tr`
- **Full:** `en,ar,cz,de,es,fr,id,it,kk,lt,ms,nl,pl,pt,ru,sl,th,tr,vi,zh` (same as xr)

---

## Process — 6 Steps

### Step 1 — Create Image Folder

```bash
mkdir -p assets/images/<name>
```

Generate 18 images using ImageMagick (replace COLOR vars with the theme):

```bash
DIR="assets/images/<name>"
NAVY="<bg1>"   # e.g. #071330
BLUE="<bg2>"   # e.g. #0f2d6e
CYAN="<accent>"  # e.g. #00c8ff

# hero-bg.png  4368x2448
magick -size 4368x2448 gradient:"${NAVY}-${BLUE}" \
  -fill none \
  -stroke "${CYAN}20" -strokewidth 350 -draw "circle 3900,3100 3900,1500" \
  -stroke "${CYAN}15" -strokewidth 200 -draw "circle 200,100   200,1300" \
  "${DIR}/hero-bg.png"

# Feature cards  763x509  (image-1, 2, 3)
for i in 1 2 3; do
  magick -size 763x509 gradient:"${NAVY}-${BLUE}" \
    -fill none -stroke "${CYAN}30" -strokewidth 60 \
    -draw "circle 650,500 650,300" \
    -fill "${CYAN}80" \
    -draw "roundrectangle 60,180 340,300 12,12" \
    -draw "roundrectangle 60,320 260,340 6,6" \
    -draw "roundrectangle 60,360 300,380 6,6" \
    -fill none -stroke "${CYAN}" -strokewidth 2 \
    -draw "roundrectangle 55,170 345,430 14,14" \
    "${DIR}/image-${i}.png"
done

# Square 800x800  (image-4, 7)
for i in 4 7; do
  magick -size 800x800 radial-gradient:"${NAVY}-${BLUE}" \
    -fill none -stroke "${CYAN}40" -strokewidth 3 \
    -draw "circle 400,400 400,80" \
    -stroke "${CYAN}20" -strokewidth 2 \
    -draw "circle 400,400 400,200" \
    -fill "${CYAN}90" -draw "circle 400,400 400,395" \
    -fill "${NAVY}" -draw "rectangle 350,320 450,480" \
    "${DIR}/image-${i}.png"
done

# Icons 512x512  (image-5, 6, 8, 9, 13, 14, 15, 16, 17)
for i in 5 6 8 9 13 14 15 16 17; do
  magick -size 512x512 gradient:"${NAVY}-${BLUE}" \
    -fill none -stroke "${CYAN}50" -strokewidth 3 \
    -draw "circle 256,256 256,60" \
    -fill "${CYAN}" -draw "roundrectangle 176,176 336,336 20,20" \
    -fill "${NAVY}" -draw "roundrectangle 196,196 316,316 14,14" \
    -fill "${CYAN}" \
    -draw "rectangle 220,230 292,250" \
    -draw "rectangle 220,262 292,282" \
    -draw "rectangle 220,294 264,314" \
    "${DIR}/image-${i}.png"
done

# Small icon  270x270  (image-10)
magick -size 270x270 radial-gradient:"${BLUE}-${NAVY}" \
  -fill none -stroke "${CYAN}60" -strokewidth 2 \
  -draw "circle 135,135 135,20" \
  -fill "${CYAN}" -draw "roundrectangle 85,85 185,185 12,12" \
  -fill "${NAVY}" -draw "roundrectangle 95,95 175,175 8,8" \
  -fill "${CYAN}" \
  -draw "rectangle 105,110 165,125" \
  -draw "rectangle 105,135 165,150" \
  -draw "rectangle 105,160 140,175" \
  "${DIR}/image-10.png"

# Banners  256x125  (image-11, 12)
for i in 11 12; do
  magick -size 256x125 gradient:"${NAVY}-${BLUE}" \
    -fill none -stroke "${CYAN}40" -strokewidth 60 \
    -draw "circle 256,62 256,-20" \
    -fill "${CYAN}" -draw "roundrectangle 14,40 46,85 6,6" \
    -fill "${NAVY}" -draw "roundrectangle 17,43 43,82 4,4" \
    -fill "${CYAN}cc" \
    -draw "rectangle 19,50 41,57" \
    -draw "rectangle 19,61 41,68" \
    "${DIR}/image-${i}.png"
done
```

### Step 2 — Create i18n/en.js

Create `_data/i18n/<name>/en.js`. Use `lumibrain/en.js` as the canonical structure reference — it is the most complete and up-to-date template.

**Rules:**
- Copy the exact export structure from `lumibrain/en.js`
- Replace all karaoke/brain-training references with product-appropriate copy
- Keep all `${portfolio.productDisplayName}`, `${portfolio.customerCareEmail}`, `${portfolio.domain}` interpolations intact
- Keep `const getObfuscatedHtml = require('../../../utils/obfuscator')` at the top
- Keep `getObfuscatedHtml(portfolio.mcc)`, `getObfuscatedHtml(portfolio.address)` in the footer
- Keep `new Date().getFullYear()` in the copyright

**Sections to write** (all required):
`subscriptionSection`, `subscriptionSteps`, `subscriptionStepsCC`, `unsubscriptionSection`, `unsubscriptionSectionCC`, `refundPolicySection`, `featuresSection` (feature1–6), `faqSection` (faq1–6), `testimonials` (testimonial1–6), `home` (heroTitle, heroDescription, heroDescription2, exploreSection, aboutSection with about1–6, gallerySection, categoriesSection), `about` (heroTitle–3, values, milestones with milestone1–6, vision), `pricing` (heroTitle, heroDescription, heroDescription2), `contact`, `signin`, `navigation`, `footer`

### Step 3 — Generate Language Translations

For each language code in the requested set, create `_data/i18n/<name>/<lang>.js`.

**Translation rules:**
1. Start from `en.js` — translate only string values, never keys
2. Preserve ALL template literals: `${portfolio.productDisplayName}` stays exactly as-is
3. Preserve HTML entities: `&copy;`, `&amp;`, etc.
4. Preserve `new Date().getFullYear()` and `getObfuscatedHtml(...)` calls unchanged
5. Use natural, native-speaker phrasing — not literal word-for-word translation
6. Keep `require('../../../utils/obfuscator')` import unchanged

**Language codes → names:**
`ar`=Arabic, `cz`=Czech, `de`=German, `el`=Greek, `es`=Spanish, `fr`=French, `id`=Indonesian, `it`=Italian, `kk`=Kazakh, `lt`=Lithuanian, `ms`=Malay, `nl`=Dutch, `pl`=Polish, `pt`=Portuguese, `ro`=Romanian, `ru`=Russian, `sl`=Slovenian, `sr`=Serbian, `th`=Thai, `tr`=Turkish, `vi`=Vietnamese, `zh`=Chinese (Simplified)

**Batch strategy:** Translate 2–3 languages per agent call to avoid context overflow. Use parallel agents for independent languages.

### Step 4 — Register Filter in eleventy.config.js

In [eleventy.config.js](eleventy.config.js), find the `filters` object inside the `getContent` function (around line 56). Add one line:

```js
// After the last entry in the filters object:
<name>Content: '<name>',
```

The filter key must be camelCase with `Content` suffix: `musicContent`, `astrologyContent`, `cookingContent`.

### Step 5 — Register in i18n-setup.liquid

In [_includes/partials/i18n-setup.liquid](_includes/partials/i18n-setup.liquid), find the `{% elsif pair.contentTemplate == 'pdfbrain-ai' %}` block (currently the last entry). Add after it:

```liquid
{% elsif pair.contentTemplate == '<name>' %}
  {% assign contentData = currentLang | <name>Content: pair %}
```

### Step 6 — Done ✓

Verify:
```bash
# Quick check all files created:
ls _data/i18n/<name>/
ls assets/images/<name>/
grep "<name>Content" eleventy.config.js
grep "contentTemplate == '<name>'" _includes/partials/i18n-setup.liquid
```

After confirming, remind the user to:
1. Update Notion portfolio page status → **"build"**
2. Trigger Jenkins: https://jenkins.sam-media.com/job/Design/job/Dmb-Portfolios/

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Filter key not camelCase | `musicContent` not `music_content` or `Music Content` |
| Missing `Content` suffix in filter key | `musicContent: 'music'` not `music: 'music'` |
| Liquid uses filter key not folder name | `\| musicContent:` refers to the JS filter name |
| Template literal stripped in translation | Must keep `${portfolio.productDisplayName}` verbatim |
| Wrong `require` path in nested i18n file | Always `'../../../utils/obfuscator'` (3 levels up) |
| Forgot to add logo to `assets/images/logos/` | Step 1 — user provides logo file |
