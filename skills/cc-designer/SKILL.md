---
name: cc-designer
description: Use when designing new credit card landing pages, customizing design systems for new products, or replicating the unified portfolio+payment flow design across brands
---

# CC Designer

## Overview

**The cc-designer skill is the visual equivalent of cc-page.** Where cc-page handles architecture and setup, cc-designer handles the complete visual design system.

This skill gives you the design knowledge embedded in the development branch's `src/portfolio/portfolio.scss` and component library — so you can replicate, customize, and evolve the design for any product without reinventing tokens, components, or patterns.

**Core principle:** Design systems compound across products. One token change (color, spacing) applies everywhere. This skill teaches you to think in tokens, not in one-off colors or sizes.

---

## When to Use This Skill

**Use cc-designer when:**
- ✅ Creating a new product landing page (new brand, new color palette)
- ✅ Customizing colors/typography/spacing for a variant
- ✅ Building components that follow the unified design system
- ✅ Ensuring responsive design and accessibility compliance
- ✅ Auditing existing designs for consistency
- ✅ Documenting design decisions for handoff to developers

**Don't use cc-designer when:**
- ❌ Implementing markup (use cc-page for full page setup)
- ❌ Writing component logic (that's code architecture, not design)
- ❌ General UI/UX advice unrelated to cc-template (use ux-design skill)

---

## The Design System Architecture

### Token Hierarchy (Foundation Layer)

All visual decisions flow from five token families:

```
Colors (semantic names)
  └─ primary, primary-light, primary-lighter, primary-accent
  └─ surface, surface-2, border, text-primary/secondary/muted/inverse
  └─ semantic: success, warning, danger, info

Spacing (proportional scale)
  └─ xs:4px, sm:8px, md:12px, lg:16px, xl:24px, 2xl:32px, 3xl:48px, 4xl:64px, 5xl:80px

Typography (hierarchy + metrics)
  └─ xs-5xl: size, weight, line-height
  └─ Examples: xs:0.75rem/500/1rem, base:1rem/400/1.5rem, 5xl:3rem/900/3.5rem

Shadows (elevation + depth)
  └─ none, sm, md, lg, xl, 2xl, inner
  └─ All use neutral-950 for cohesion

Border Radius (shape consistency)
  └─ sm:4px, md:8px, lg:12px, xl:16px, 2xl:24px, full:9999px

Transitions (motion)
  └─ fast:150ms, base:200ms, slow:300ms (cubic-bezier easing)
```

### Component Tier (Patterns Layer)

Built ON tokens, not replacing them:

| Component | Purpose | Variants |
|-----------|---------|----------|
| `.pf-hero` | Hero section with gradient bg | `--subscribe` (tall), default |
| `.pf-btn` | Button with states | primary, secondary, outline, ghost (×3 sizes) |
| `.pf-card` | Card with elevation on hover | default, featured (accent bar) |
| `.pf-section` | Content block | `--alt` (surface background), `--hero` (gradient) |
| `.pf-nav` | Sticky navigation | Logo, links, CTA, hamburger |
| `.pf-grid` | Responsive grid | 3-col (300px min), 2-col (380px min) |
| `.pf-footer` | Dark theme footer | Links grid, contact info |

### Design Decisions (Psychology Layer)

Every token choice has documented reasoning:

- **Color psychology:** Primary #1f40a8 (professional blue) = trust + intelligence (for document AI). Not reds (aggressive) or greens (health).
- **Typography:** 1.6 line-height exceeds WCAG (1.5) for dyslexic users scanning documents.
- **Spacing:** 8px grid divisible by 2/4/8 enforces consistency.
- **Shadows:** 6-level system clarifies interactive hierarchy (buttons appear above cards).
- **Responsive:** Mobile-first forces clarity. 5 breakpoints (320px, 768px, 1024px, 1280px, 1536px).
- **Accessibility:** WCAG AAA (7+:1 contrast), 44px touch targets, motion preferences respected.

---

## Quick Start: Replicating Design for a New Product

### Phase 1: Audit the Source (15 minutes)

**Know what you're inheriting:**

1. Read `src/portfolio/portfolio.scss` (lines 1–150: token definitions)
2. Identify these five families:
   - `$colors` map (lines 13–38)
   - `$space` map (lines 40–51)
   - `$typography` map (lines 53–100)
   - `$shadows` map (lines 112–121)
   - `$radius` map (lines 102–110)

3. Note the **mixin helpers** (lines 133–155):
   ```scss
   @mixin color($key) { color: map-get($colors, $key); }
   @mixin bg($key) { background-color: map-get($colors, $key); }
   @mixin shadow($key) { box-shadow: map-get($shadows, $key); }
   ```

4. Understand the **component patterns** (lines 365–500+):
   - `.pf-hero`: gradient background + centered content
   - `.pf-btn`: 5 variants × 3 sizes = 15 combinations
   - `.pf-card`: elevation on hover, featured variant
   - `.pf-section`: alternating backgrounds

### Phase 2: Extract Brand Identity (10 minutes)

**For your new product, define:**

| Question | Example (DocPilotAI) | Your Product |
|----------|---|---|
| Primary brand color (hex)? | #2563EB (blue) | ? |
| What does it convey? | Trust, intelligence, professionalism | ? |
| Secondary colors (accent, success, warning)? | Cyan (#0ea5e9), green, orange | ? |
| Primary font? | Inter (600+ weight range) | ? (must be web-safe) |
| Tone (formal/playful/modern)? | Professional, enterprise | ? |
| Target users? | Professionals, enterprises | ? |
| Key values? | Security, accuracy, speed | ? |
| Accessibility needs? | WCAG AA minimum | ? |

### Phase 3: Customize Tokens (20 minutes)

**Copy the SCSS template and update only the token maps:**

```scss
// ============================================================
// DESIGN TOKENS — Customize Only These
// ============================================================

// 1. PRIMARY COLOR — Change this first
$brand-primary: #YOUR_HEX;  // e.g., #FF6B35 for orange
$brand-primary-light: lighten($brand-primary, 10%);
$brand-primary-lighter: lighten($brand-primary, 25%);
$brand-primary-accent: adjust-hue($brand-primary, 30deg);  // Complementary

// 2. TEXT & SURFACE COLORS — Keep structure, adjust for your palette
$colors: (
  'primary': $brand-primary,
  'primary-light': $brand-primary-light,
  'primary-lighter': $brand-primary-lighter,
  'primary-accent': $brand-primary-accent,
  
  // Neutrals: cool gray for professional, warm gray for friendly
  'white': #ffffff,
  'surface': #f8fafc,        // Light gray
  'surface-2': #f1f5f9,      // Medium gray
  'border': #e2e8f0,
  'text-primary': #0f172a,   // Navy (trustworthy)
  'text-secondary': #475569,
  'text-muted': #94a3b8,
  'text-inverse': #ffffff,
  
  // Semantic: same for all products
  'success': #10b981,
  'warning': #f59e0b,
  'danger': #ef4444,
  'info': #0ea5e9,
);

// 3. SPACING — Rarely changed (8px grid is universal)
$space: (
  'xs': 4px, 'sm': 8px, 'md': 12px, 'lg': 16px, 'xl': 24px,
  '2xl': 32px, '3xl': 48px, '4xl': 64px, '5xl': 80px,
);

// 4. TYPOGRAPHY — Adjust line-height only if dyslexia accessibility needed
$typography: (
  'xs': ('size': 0.75rem, 'weight': 500, 'line': 1rem),
  'sm': ('size': 0.875rem, 'weight': 400, 'line': 1.25rem),
  'base': ('size': 1rem, 'weight': 400, 'line': 1.5rem),  // Main body
  'lg': ('size': 1.125rem, 'weight': 500, 'line': 1.75rem),
  'xl': ('size': 1.25rem, 'weight': 600, 'line': 1.75rem),
  '2xl': ('size': 1.5rem, 'weight': 700, 'line': 2rem),
  '3xl': ('size': 1.875rem, 'weight': 700, 'line': 2.25rem),
  '4xl': ('size': 2.25rem, 'weight': 800, 'line': 2.5rem),
  '5xl': ('size': 3rem, 'weight': 900, 'line': 3.5rem),  // Hero
);

// 5. SHADOWS — Keep as-is for consistency
$shadows: (
  'none': none,
  'sm': 0 1px 2px 0 rgba(15, 23, 42, 0.05),
  'md': 0 4px 6px -1px rgba(15, 23, 42, 0.1),
  'lg': 0 10px 15px -3px rgba(15, 23, 42, 0.15),
  'xl': 0 20px 25px -5px rgba(15, 23, 42, 0.2),
  '2xl': 0 25px 50px -12px rgba(15, 23, 42, 0.25),
  'inner': inset 0 2px 4px 0 rgba(15, 23, 42, 0.05),
);

// 6. BORDER RADIUS — Keep as-is
$radius: (
  'sm': 4px, 'md': 8px, 'lg': 12px, 'xl': 16px, '2xl': 24px, 'full': 9999px,
);

// 7. TRANSITIONS — Keep as-is for motion consistency
$transitions: (
  'fast': 150ms cubic-bezier(0.4, 0, 1, 1),
  'base': 200ms cubic-bezier(0.4, 0, 0.2, 1),
  'slow': 300ms cubic-bezier(0.4, 0, 0.2, 1),
);

// ============================================================
// MIXINS — Don't change, just use
// ============================================================

@mixin color($key) { color: map-get($colors, $key); }
@mixin bg($key) { background-color: map-get($colors, $key); }
@mixin border($key) { border-color: map-get($colors, $key); }
@mixin shadow($key) { box-shadow: map-get($shadows, $key); }
@mixin transition($key) { transition: all map-get($transitions, $key); }

@function font-size($key) { @return map-get(map-get($typography, $key), 'size'); }
@function font-weight($key) { @return map-get(map-get($typography, $key), 'weight'); }
@function line-height($key) { @return map-get(map-get($typography, $key), 'line'); }
@mixin type($key) {
  font-size: font-size($key);
  font-weight: font-weight($key);
  line-height: line-height($key);
}

// ============================================================
// COMPONENTS — Copy from portfolio.scss, no changes needed
// ============================================================
// .pf-hero, .pf-btn, .pf-card, .pf-section, .pf-nav, .pf-footer, etc.
// All components automatically use your custom token values above
```

**That's it.** Every component (buttons, cards, hero, footer) automatically updates to use your new colors.

### Phase 4: Test Across Scenarios (15 minutes)

**Verify your tokens work:**

```bash
# 1. Check color contrast (must be 7:1 for WCAG AAA)
# Use https://webaim.org/resources/contrastchecker
# Test: primary on white, primary on surface, text-secondary on white

# 2. Check responsive design
# Open your page in Chrome DevTools:
#   - 375px (mobile)
#   - 768px (tablet)
#   - 1280px (desktop)
#   - 1920px (ultra-wide)

# 3. Test keyboard navigation
# Tab through entire page. Can you reach all buttons? All interactive elements?

# 4. Test with screen reader
# Try NVDA (Windows) or VoiceOver (Mac)
# Can the reader describe each section clearly?

# 5. Test motion preferences
# Set prefers-reduced-motion: reduce in DevTools
# Do animations still work? Do they respect user preference?
```

---

## Design Decisions Reference

### Color Psychology (Why These Colors?)

| Color | Psychology | Use Case | Example |
|-------|-----------|----------|---------|
| Professional Blue (#1f40a8) | Trust, intelligence, stability | Document AI, fintech, enterprise | DocPilotAI |
| Orange (#FF6B35) | Energy, approachability, innovation | Payment, startup, creativity | PayFlow |
| Green (#10b981) | Growth, success, positive | Confirmations, subscriptions, wins | Success states |
| Red (#ef4444) | Urgency, caution, error | Warnings, deletions, errors | Error states |
| Navy (#0f172a) | Professional, premium, trustworthy | Text, backgrounds, authority | Primary text |

**Rule:** Never use bright reds as primary (aggressive). Never use warm grays (cheap feeling).

### Typography Strategy

**Why 1.6 line-height?**
- WCAG minimum = 1.5
- Dyslexic users = 1.7+
- Document scanning (common for DocPilotAI) = 1.6
- Result: Readable for everyone, professional not cramped

**Why 9 scales (xs–5xl)?**
- Hierarchy: xs for captions, 5xl for hero
- Flexibility: adjust without reinventing
- Consistency: every size has matching weight + line-height

**Why Inter font?**
- Web-safe, available in all weights (300–900)
- Professional appearance (used by Stripe, Figma, GitHub)
- Excellent dyslexia-friendly letterforms (a, g, 1, l clearly distinct)

### Spacing Philosophy (8px Grid)

**Why 8px base unit?**
- Divisible by 2, 4, 8 (works with any design tool)
- Large enough to see (not 4px), small enough to be precise (not 16px)
- Natural rhythm: 8, 16, 24, 32, 48, 64, 80
- Mobile-safe: 48px + 8px = 56px (above minimum 44px touch target)

**Never use arbitrary values:**
- ❌ `padding: 13px;` (breaks grid)
- ✅ `padding: map-get($space, 'md');` (12px, on grid)

### Shadow System (Clarifying Depth)

**6 levels = 6 layers of elevation:**
- `none`: Flat, no interaction possible
- `sm`: Subtle, secondary (disabled buttons, hints)
- `md`: Normal, interactive (buttons, form inputs)
- `lg`: Elevated, prominent (modal overlays, cards on hover)
- `xl`: High, attention (drawers, stacked modals)
- `2xl`: Highest, critical (tooltips over everything)

**Neutral-950 color:** Shadows use navy (not pure black) for sophistication. Pure black feels harsh.

### Responsive Strategy (Mobile-First)

**5 breakpoints:**
- 320px: Phone (min width)
- 768px: Tablet (landscape)
- 1024px: Desktop
- 1280px: Desktop (large)
- 1536px: Ultra-wide

**Mobile-first principle:**
- Write base styles for 320px
- Add `@media (min-width: 768px)` to enhance
- Never remove features on mobile (only simplify layout)

---

## Common Design Mistakes (And How System Prevents Them)

### ❌ The Biggest Mistakes (Under Deadline Pressure)

| Mistake | Why It Happens | System Prevention | Fix Time |
|---------|---|---|---|
| "Dark theme needs custom spacing grid" | Feels smaller visually, so... increase grid | **Never customize spacing** — reuse 8px grid exactly | Test on device (5 min) |
| "Buttons feel small, increase size everywhere" | Optical illusion on dark bg | Adjust button padding only, not grid (see Phase 4) | Component-level, not global |
| "New product needs custom typography" | Theme feeling different | **Never customize typography** — reuse xs–5xl exactly | Test contrast at webaim.org |
| "Shadows don't work on dark, invent new ones" | Navy shadows disappear on dark | Swap shadow color (navy → white), keep structure | 30 minutes, not 3 hours |
| "Button text hard to read, increase font" | Could be contrast, could be size, could be color | **Verify contrast first** (2 min), then fix root cause | Decision tree (below) |
| Hardcoding colors (`#FF0000`) | "Just inline it to ship faster" | Use `@include bg('danger')` — applies to 100+ places | Reusable, themeable |
| Custom font sizes (`font-size: 13px`) | "This button needs to be special" | Use typography scale (xs–5xl), reuse everywhere | Consistency auto-enforced |
| Ignoring keyboard navigation | "Mobile-first, so keyboard doesn't matter" | WCAG AAA required — tab through entire page | 10 minutes, not 2 hours debug |
| Colors without contrast verification | "Looks good to me on my monitor" | Test at webaim.org (2 min) — don't guess | Prevents accessibility lawsuits |

### Pressure-Driven Rationalizations (Recognize Them)

| What You'll Think | What's Really Happening | What To Do |
|---|---|---|
| "This is a unique dark theme, I should customize everything" | Imposter syndrome. Every theme is color + shape. | Reuse system, customize only colors. 2 hours vs. 20 hours. |
| "The PM said 'don't overthink it'" | This MEANS follow the system strictly, not skip steps. | Follow system. No decisions = no overthinking = shipped on time. |
| "This component doesn't fit the system, I'll make a custom one" | You don't understand the system well enough yet. | Read component patterns, test if existing component works. Always. |
| "I can change spacing for dark theme" | You will create debt, not save time. Dark = color swap, not structure redesign. | Reuse spacing. If button feels small, adjust component padding, not grid. |
| "I'll test accessibility after launch" | You'll have lawsuits after launch. Test now (10 minutes). | webaim.org, keyboard nav, screen reader. Do it now. |

---

## Decision Tree: Troubleshooting Under Pressure

**When something "doesn't look right," follow this tree BEFORE customizing:**

```
Is your design not matching your vision?
│
├─ Text hard to read?
│  ├─ On light background?
│  │  └─ Check contrast at webaim.org
│  │     ├─ Failed (<7:1)? → Lighten text color (use lighter color token)
│  │     └─ Passed (7:1+)? → Not a contrast issue, move to next check
│  │
│  └─ On dark background?
│     ├─ White text on dark primary? → Should be fine, check webaim
│     └─ If contrast OK, check color semantics (see below)
│
├─ Button feeling small/large?
│  ├─ Measure on device with DevTools (should be 44px+ tall for thumb)
│  │  ├─ <44px? → Increase button padding (component-level only)
│  │  └─ >44px? → Size is fine, move to next check
│  │
│  └─ Optical illusion on dark bg? → Verify button uses primary color, not secondary
│
├─ Color semantics confusing?
│  ├─ Is button too light/washed out on dark bg?
│  │  └─ Add border: `border: 1px solid map-get($colors, 'border')`
│  │
│  └─ Is link or accent hard to distinguish?
│     └─ Verify using primary color, not secondary
│
├─ Spacing feeling off?
│  ├─ Too cramped? → Increase padding on specific component (use $space)
│  │                 (never increase $space map itself)
│  │
│  └─ Too loose? → Decrease padding on specific component
│
├─ Animation feels wrong?
│  └─ Test motion preference: DevTools → ...more tools → Rendering
│     → Toggle "Emulate CSS media feature prefers-reduced-motion"
│     → Should still animate (just respect user preference)
│
└─ STOP: Document what you changed and why
   └─ Component-level fixes are OK
   └─ System-level changes (spacing, typography) are NOT OK
```

---

## The Iron Rule of Token-Based Design

```
ONLY THE COLOR MAP CAN BE CUSTOMIZED

┌─────────────────────────────────────────┐
│ CUSTOMIZE (per-product)                 │
├─────────────────────────────────────────┤
│ $colors:                                │
│   primary, primary-light, primary-lighter,
│   surface, surface-2, border            │
│   (everything else carries over)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ NEVER TOUCH (universal)                 │
├─────────────────────────────────────────┤
│ $space (8px grid)                       │
│ $typography (xs–5xl scales)             │
│ $shadows (6-level system)               │
│ $radius (5 semantic values)             │
│ $transitions (3 speeds)                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ COMPONENT-LEVEL TWEAKS OK               │
├─────────────────────────────────────────┤
│ Button padding adjustment (not grid)    │
│ Card border styling                     │
│ Section spacing (use $space values)     │
│ Shadow on hover (from $shadows)         │
│ (But never redefine a token)            │
└─────────────────────────────────────────┘
```

**Violating this = lost time + inconsistent products.**

---

## Checklist: Before Handing Off to Dev

- [ ] All colors use semantic names (`'primary'`, not `'#1f40a8'`)
- [ ] All spacing uses 8px grid (`'lg'`, not `'18px'`)
- [ ] All typography uses defined scales (xs–5xl, not custom)
- [ ] Button variants: 5 types × 3 sizes = all 15 tested
- [ ] Card hover effects: `transform: translateY(-6px)` on desktop, none on mobile
- [ ] Navigation: sticky, 70px height, logo left, links center, CTA right
- [ ] Footer: dark theme (`'text-inverse'`), grid layout, contact info
- [ ] Hero: gradient background + radial decoration + centered content
- [ ] Contrast tested: primary on white, primary on surface (7:1+ WCAG AAA)
- [ ] Responsive: 320px, 768px, 1024px, 1280px, 1536px all visually correct
- [ ] Keyboard nav: tab through entire page, all targets reachable
- [ ] Screen reader: semantics clear (headings, buttons, regions)
- [ ] Motion preference: animations respect `prefers-reduced-motion`
- [ ] Dark mode (optional): define `$colors-dark` map if needed
- [ ] Documentation: design decisions recorded (color psychology, spacing rationale, etc.)

---

## Real-World Examples

### Example 1: Blue FinTech (Like DocPilotAI)

```scss
$brand-primary: #1f40a8;      // Professional blue (trust)
$colors: (
  'primary': $brand-primary,
  'primary-light': #2563eb,   // Lighter for hover
  'primary-lighter': #dbeafe, // For backgrounds
  'success': #10b981,         // Green for transactions
  'danger': #ef4444,          // Red for declines
  // ... rest of map
);
```
**Psychology:** Blue conveys trust (banking), security (documents), intelligence (AI).

### Example 2: Orange Startup (Like PayFlow)

```scss
$brand-primary: #FF6B35;      // Vibrant orange (energy)
$colors: (
  'primary': $brand-primary,
  'primary-light': #ff8a5b,   // Lighter for hover
  'primary-lighter': #fff0eb, // For backgrounds
  'success': #10b981,         // Green unchanged
  'danger': #ef4444,          // Red unchanged
  // ... rest of map
);
```
**Psychology:** Orange conveys innovation (startup), approachability (friendly), energy (fast payments).

### Example 3: Green Health-Tech

```scss
$brand-primary: #10b981;      // Green (growth, health)
$colors: (
  'primary': $brand-primary,
  'primary-light': #34d399,
  'primary-lighter': #d1fae5,
  'success': #10b981,         // Reinforces primary
  'danger': #ef4444,          // Red for alerts
  // ... rest of map
);
```
**Psychology:** Green conveys health (medical), growth (wellness), natural (organic).

---

## Bridge to Implementation

**This skill is design-only.** Once you have your tokens defined:

1. **Use cc-page** to set up the complete page structure (routing, components, i18n)
2. **Use cc-designer** (this skill) to customize colors, spacing, typography
3. **Collaborate with dev:** Dev implements using the token-based SCSS you provide

**Design → Dev handoff:**
- Copy your customized SCSS token maps
- Provide contrast verification (screenshot of webaim.org test)
- Document color psychology decisions (helps dev make future tweaks)
- Provide responsive breakpoint testing (screenshots at 320/768/1024/1280/1536)

---

## When Design and Code Diverge

**If implemented code doesn't match design:**
1. Check token values: is the SCSS using your customized colors?
2. Check CSS is compiled: browser DevTools → Inspect → look for `.pf-btn { background-color: #... }`
3. Check class names: is the HTML using `.pf-btn--primary`? (common mistake: using `.primary` without prefix)
4. Check responsive breakpoints: does mobile show the right layout? Use DevTools device emulation (375px, 768px)

**If a component is missing:**
1. Is it defined in portfolio.scss? (search for `.pf-card`, `.pf-grid`, etc.)
2. Is the HTML markup correct? (check class names, nesting, data attributes)
3. Is the SCSS compiled? (browser → View Source → look for `<link rel="stylesheet" href="...bundle.css">`)

---

**Version:** 1.0  
**Last Updated:** May 28, 2026  
**Related Skills:** cc-page (page setup), ux-design (general UI/UX principles)  
**Questions?** I understand the complete design system in development branch and can help with any customization, color psychology decisions, or responsive design questions.
