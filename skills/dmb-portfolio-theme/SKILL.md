---
name: dmb-portfolio-theme
description: Use when creating a new visual theme (themeN.scss) for the dmb-portfolios 11ty project. Triggers on "create theme", "new theme", "add theme", "theme6", "theme7", or any request to build a new visual style for a portfolio site. All styling must go in the SCSS theme file only — never touch HTML.
---

# DMB Portfolio Theme Creator

## Overview

Creates a new `themeN.scss` for the `dmb-portfolios` 11ty project. A theme is a single self-contained SCSS file that overrides all visual variables and component styles. **Zero HTML changes — ever.** Everything goes in the theme file.

**Repo:** `/Users/sabiridwan/SamMedia/dmb-portfolios`
**Existing themes:** `theme1–theme5` in `assets/styles/pages/`

---

## HARD RULE — No HTML Changes

**NEVER modify any `.html`, `.liquid`, `.njk`, or template file.**

All design changes — colors, typography, spacing, layout, logo swaps, component redesigns — are achieved through CSS overrides in the theme SCSS file only. If something looks wrong, the fix is always in the theme file.

---

## Inputs — Collect Before Starting

| Input | Example | Notes |
|---|---|---|
| `themeNumber` | `6` | Next available number after existing themes |
| `mood` | Dark mode, glassmorphism, warm luxury | Visual direction |
| `palette` | Background, surface, text, accent hex values | Core colors |
| `fonts` | `Space Grotesk + Inter` | Google Fonts pairing |
| `accentColor` | `#3B82F6` | Primary CTA / highlight color |

Use `superpowers:brainstorming` to nail down palette and mood before writing any code.

---

## File Location & Compile

```
assets/styles/pages/themeN.scss   ← source (edit this)
assets/styles/pages/themeN.css    ← compiled output
_site/styles/themes/themeN.css    ← built output (auto-copied by 11ty)
```

**Compile:**
```bash
npx sass assets/styles/pages/themeN.scss assets/styles/pages/themeN.css --style=compressed
```

**Full site build:**
```bash
npm run build
```

Deprecation warnings about `@import` in `_pricing.scss` and `_inputs.scss` are expected — they exist in all themes. Only actual errors matter.

**Assign to a site** — edit `_data/configs/<site>.js`:
```js
theme: 'theme6.css',
```

---

## Required SCSS Structure

Every theme starts with these `@use` imports (exact order, no changes):

```scss
@use '_variables' as *;
@use '_reset' as *;
@use '_header' as *;
@use '_typography' as *;
@use '_button' as *;
@use '_card' as *;
@use '_grid' as *;
@use '_tabs' as *;
@use '_footer' as *;
@use '_pricing' as *;
@use '_inputs' as *;
@use '_accordion' as *;
@use '_menu' as *;

// Theme Name — short description
@import url('https://fonts.googleapis.com/css2?family=...');
```

---

## CSS Variables — Full `:root` Block

Define ALL of these. Every variable must have a value — undefined variables cause silent visual bugs across all sites.

```scss
:root {
  // ─── Core palette ─────────────────────────────────────────────────────────
  --clr-primary:         ;   // main accent — CTAs, links
  --clr-primary-mid:     ;   // lighter accent — hover states
  --clr-primary-surface: ;   // faint accent wash — active states
  --clr-secondary:       ;   // body background
  --clr-tertiary:        ;   // alternate section background
  --clr-light:           ;   // white or near-white
  --clr-dark:            ;   // near-black — footer, headings
  --clr-body-text:       ;   // main text color
  --clr-border:          ;   // border color

  // ─── Container ────────────────────────────────────────────────────────────
  --max-width-container: 1200px;
  --container-y-padding: clamp(2rem, 5vw, 5rem);
  --container-x-padding: clamp(1rem, 1vw + 0.75rem, 5rem);
  --grid-2: repeat(auto-fit, minmax(calc(var(--max-width-container) / 2 - 2rem), 1fr));
  --grid-3: repeat(auto-fit, minmax(min(100%, calc(var(--max-width-container) / 3 - var(--container-x-padding))), 1fr));
  --grid-4: repeat(auto-fit, minmax(calc(var(--max-width-container) / 4 - 2rem), 1fr));
  --grid-6: repeat(auto-fit, minmax(calc(var(--max-width-container) / 6 - 2rem), 1fr));

  // ─── Text ─────────────────────────────────────────────────────────────────
  --clr-text:          var(--clr-dark);
  --clr-text-inverted: var(--clr-light);
  --clr-text-muted:    ;   // secondary / caption text

  // ─── Surfaces ─────────────────────────────────────────────────────────────
  --clr-surface-body:      var(--clr-secondary);
  --clr-surface-text:      var(--clr-body-text);
  --clr-surface-section:   var(--clr-secondary);
  --clr-surface-container: var(--clr-dark);

  // ─── Nav ──────────────────────────────────────────────────────────────────
  --clr-nav-text:          var(--clr-body-text);
  --clr-nav--text:         var(--clr-body-text);
  --clr-nav-text-inverted: var(--clr-light);
  --clr-nav-background:    ;   // semi-transparent for backdrop blur
  --clr-nav-cta-surface:   var(--clr-primary);
  --clr-nav-cta-text:      var(--clr-light);
  --clr-nav--btn-text:     var(--clr-light);
  --clr-menu-background:   ;

  // ─── Language selector ────────────────────────────────────────────────────
  --clr-lang-button-background: ;
  --clr-lang-button-text:       var(--clr-body-text);
  --clr-lang-button-foreground: ;
  --clr-lang-button-border:     var(--clr-border);
  --clr-lang-item-border:       var(--clr-border);
  --clr-lang-item-text:         var(--clr-body-text);

  // ─── Hero ─────────────────────────────────────────────────────────────────
  --clr-hero-surface: var(--clr-secondary);
  --clr-hero-text:    var(--clr-dark);

  // ─── Lead title ───────────────────────────────────────────────────────────
  --clr-lead-title-text: var(--clr-dark);

  // ─── Cards ────────────────────────────────────────────────────────────────
  --clr-card-background: ;
  --clr-card-foreground: ;   // title stripe background (used in base _card.scss)
  --clr-card-text:       var(--clr-body-text);
  --clr-card-price:      var(--clr-primary);
  --clr-card-frequency:  var(--clr-text-muted);
  --clr-card-border:     var(--clr-border);

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  --clr-tab-background: var(--clr-tertiary);
  --clr-tab-border:     var(--clr-border);
  --clr-tab-text:       var(--clr-body-text);
  --clr-tab-icon:       var(--clr-primary);
  --clr-tab-hover:      color-mix(in srgb, var(--clr-primary) 85%, black);

  // ─── Inputs ───────────────────────────────────────────────────────────────
  --clr-input-background:  ;
  --clr-input-border:      var(--clr-border);
  --clr-input-text:        var(--clr-body-text);
  --clr-input-placeholder: ;

  // ─── Buttons ──────────────────────────────────────────────────────────────
  --clr-button-primary:         var(--clr-primary);
  --clr-button-primary-text:    var(--clr-light);
  --clr-button-primary-hover:   color-mix(in srgb, var(--clr-primary) 80%, black);
  --clr-button-secondary:       ;
  --clr-button-secondary-text:  var(--clr-primary);
  --clr-button-secondary-hover: ;

  // ─── Sign-in ──────────────────────────────────────────────────────────────
  --clr-signin-form-disclaimer: var(--clr-text-muted);

  // ─── Footer ───────────────────────────────────────────────────────────────
  --clr-footer-text:      ;
  --clr-footer-link-text: ;
  --clr-footer-border:    ;

  // ─── Legal ────────────────────────────────────────────────────────────────
  --clr-legal-background: var(--clr-tertiary);
  --clr-legal-text:       var(--clr-body-text);

  // ─── Typography scale ─────────────────────────────────────────────────────
  --fnt-size-1: 1.5rem;
  --fnt-size-2: 2rem;
  --fnt-size-3: 2.5rem;
  --fnt-size-4: 3rem;
  --fnt-size-5: 4rem;

  // ─── Spacing ──────────────────────────────────────────────────────────────
  --spacer: 1rem; --spacer-2: 2rem; --spacer-3: 3rem; --spacer-4: 4rem;

  // ─── Feedback ─────────────────────────────────────────────────────────────
  --clr-success: ;
  --clr-error:   ;
  --clr-warning: ;

  // ─── Icon filter — CSS filter to tint SVG icons to accent color ───────────
  --clr-icons-filter: brightness(0) saturate(100%) invert(...) sepia(...) ...;

  --about-section-grid-columns: var(--grid-3);
}
```

**Generate the icon filter** for your accent color using:
https://codepen.io/sosuke/pen/Pjoqqp — paste your hex, copy the output.

---

## Required Component Sections

Implement ALL of these in order. Copy from theme4.scss or theme5.scss as a base, then swap colors/fonts.

| Section | Key classes |
|---|---|
| Body | `body` |
| Headings | `h1–h6` with clamp sizes |
| Sections | `section`, `section:nth-of-type(even)` |
| Nav | `.header`, `nav a`, `.menu a` |
| Nav CTA | `.button--secondary`, `.header--menu a.button` |
| Hero | `.intro-section`, `.hero-section`, glow blobs via `::before` / `::after` |
| Hero text | `.hero-section h1`, `.hero-section p` |
| Lead titles | `.lead-title h2`, `.lead-title p` |
| Cards | `.card` with hover effect |
| **Card title fix** | `.card__title` — see critical note below |
| Pricing numbers | `.operator__price`, `.operator__frequency` |
| Primary button | `.button--primary` |
| Accordion | `.accordion`, `.accordion label`, `.accordion input:checked + label` |
| Inputs | `input, textarea, select` with focus ring |
| Contact hero | `body:has(.contact-section) .intro-section.bg-primary` |
| Contact section | `.contact-section` |
| Contact form | `.contact-form-section` (split panel: left sidebar + right form) |
| Language switcher | `.lang-select label.toggle`, `.lang-select .toggle-el .lang-list` |
| **Nav logo** | `.logo`, `.logo img` — see logo note below |
| Footer | `footer`, `.footer-section`, `.footer-logo` |
| Tabs | `.tabs`, `.tab-label` |
| Pricing cards | `.card--pricing`, `.card--pricing.card--featured` |
| RTL | `html { direction: ltr }`, `:lang(ar)` block |

---

## Critical: Card Title Fix

The base `_card.scss` applies `background-color`, `padding`, and `border-radius` to `.card__title`, creating a boxy banner behind every card heading. **Always override this in every theme:**

```scss
.card__title {
  color: <your-heading-color> !important;
  background: none !important;
  border-bottom: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}
```

For **pricing cards specifically**, re-add a styled header as a scoped override:
```scss
.card--pricing .card__title {
  background: linear-gradient(...) !important;
  color: #fff !important;
  padding: 0.9rem 1.5rem !important;
  border-radius: <card-radius> <card-radius> 0 0 !important;
  // ...
}
```

---

## Critical: Logo Handling

The HTML loads `<logo-name>.svg` for both nav and footer. SVGs often have a background rectangle that becomes visible if you use CSS filters. **Use `content: url()` to swap to a PNG instead.**

**For light themes (light nav background):**
```scss
.logo img {
  content: url('../../images/logos/<site>-nav.png');
  filter: none !important;
}
.footer-logo img {
  content: url('../../images/logos/<site>-white.png');
  filter: none !important;
}
```

**For dark themes (dark nav background):**
```scss
.logo img {
  content: url('../../images/logos/<site>-white.png');  // white/transparent logo
  filter: none !important;
}
.footer-logo img {
  content: url('../../images/logos/<site>-white.png');
  filter: none !important;
  opacity: 0.9;
}
```

**Never use** `filter: brightness(0) invert(1)` on SVGs — it makes background rectangles visible as a grey/white box.

Available logo files are in `assets/images/logos/`. Common pattern: `<site>.svg`, `<site>.png`, `<site>-nav.png`, `<site>-white.png`.

---

## Pricing Card — Premium Pattern

The pricing card HTML structure (read-only, never change):
```html
<div class="card card--pricing">
  <h6 class="card__title">PRICING Users</h6>
  <div class="operator card__content">
    <h4 class="operator__price">EUR 49.99</h4>
    <h4 class="operator__frequency">Per 28 days...</h4>
    <a class="button button--secondary" href="...">Subscribe Now</a>
  </div>
</div>
```

Style pattern for a polished pricing card:
```scss
.card--pricing {
  border: 1px solid <accent-transparent> !important;
  border-radius: 10px !important;
  box-shadow: 0 0 60px <accent-glow> !important;

  .card__title {
    background: linear-gradient(135deg, <dark-accent>, <accent>) !important;
    color: #fff !important;
    padding: 0.9rem 1.5rem !important;
    font-size: 0.65rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    text-align: center !important;
    border-radius: 0 !important;
  }

  .card__content {
    padding: 2rem !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
  }

  .operator__price {
    font-size: 3.75rem !important;
    font-weight: 700 !important;
    letter-spacing: -0.03em !important;
    color: <accent> !important;
    // or gradient text: background-clip + -webkit-text-fill-color
  }

  .button--secondary {
    width: 100% !important;
    justify-content: center !important;
    background: <accent> !important;
    box-shadow: 0 4px 24px <accent-glow-strong> !important;
  }
}
```

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Editing HTML to change design | Never. CSS overrides only. |
| Missing a variable in `:root` | All vars required — undefined vars silently break other sites using the same base |
| Using `brightness(0) invert(1)` on SVG logos | Use `content: url()` to swap to the PNG variant instead |
| Forgetting card title fix | Base `_card.scss` adds background/padding to `.card__title` — always reset it |
| `!important` missing on overrides | Base styles use specificity tricks — use `!important` on all component overrides |
| Forgetting RTL block | All themes must include the `:lang(ar)` RTL block at the end |
| Deprecation warnings in sass compile | Expected from `_pricing.scss` and `_inputs.scss` — not errors, safe to ignore |
| Wrong logo path after compile | CSS `content: url()` paths are relative to the **compiled CSS location** in `_site/styles/themes/` — path `../../images/logos/` is correct |

---

## Quick Reference — Theme Moods

| Mood | Background | Surface | Accent | Fonts |
|---|---|---|---|---|
| Light elegant (theme4) | `#FAFAF7` | `#F5F2EA` | `#1B4F3A` | Cormorant Garamond + Inter |
| Dark mode (theme5) | `#09090B` | `#111113` | `#3B82F6` | Space Grotesk + Inter |
| Glassmorphism | dark gradient | `rgba(255,255,255,0.08)` + blur | vibrant | Inter + any sans |
| Warm luxury | `#0C0F1A` | `#131724` | `#C9A84C` | Playfair Display + Inter |
| Neon / gaming | `#070711` | `#0E0E1A` | `#F72585` + `#00F5FF` | Rajdhani + Inter |
