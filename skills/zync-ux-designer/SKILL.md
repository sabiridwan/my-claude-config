---
name: zync-ux-designer
description: Use when designing UI components, screens, or full applications. Triggers on "design this", "build the UI", "create a screen", "make this look good", "design system", "audit consistency", "generate a preview", "show me what it looks like", or any request to produce, preview, or review visual interface work. Applies professional design thinking with mandatory consistency enforcement and visual image generation via Playwright.
---

# Zync UX Designer

Acts as a professional UI designer. Produces polished, production-grade interfaces and enforces visual consistency across every screen of the application.

**Required background:** Apply principles from `ux-design` and `design-systems` throughout.

## Mindset

Think like a senior product designer, not a developer who styles things. Every decision — spacing, color, type, motion — must be intentional and consistent with what already exists in the project.

## Workflow

```
1. Audit → 2. Token → 3. Design → 3b. Visual Preview → 4. Consistency Check → 5. Deliver
```

### 1. Audit existing patterns first

Before designing anything new, scan the codebase for:
- Existing color values, spacing, border-radius, shadows
- Existing component names and variants
- Fonts and type scale in use
- Any existing design token file (CSS vars, Tailwind config, theme file)

**Never introduce a new color, spacing value, or style that conflicts with what already exists.**

### 2. Establish or extend the token system

If no token system exists → create one before writing any component code:

```css
:root {
  /* Colors — semantic names, not hex */
  --color-primary: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-border: ...;
  --color-muted: ...;
  --color-danger: ...;
  --color-success: ...;

  /* Scale */
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;

  /* Type */
  --text-xs: 0.75rem; --text-sm: 0.875rem;
  --text-base: 1rem; --text-lg: 1.125rem; --text-xl: 1.25rem;

  /* Shape */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 16px;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,.1);
}
```

If one already exists → use it. Extend it, never override or duplicate.

### 3. Design the component or screen

Apply professional UI standards:
- Clear visual hierarchy (size, weight, color contrast)
- Consistent spacing using the token scale — no magic numbers
- Accessible contrast (WCAG AA minimum)
- All interactive states: default, hover, focus, active, disabled, loading, error
- Mobile-first, responsive by default
- Micro-interactions where they add clarity (not decoration)

### 3b. Visual Preview (generate image before finalizing)

After designing, generate a rendered screenshot so the user can see the design before you finalize code.

**How to generate the preview:**

1. Build a self-contained HTML string that embeds the design — use the actual project tokens (colors, fonts, spacing) extracted in step 1.
2. Navigate Playwright to a `data:` URL containing that HTML.
3. Take a screenshot and show it to the user.
4. Ask: "Does this match what you had in mind?" — iterate before writing final component code.

**Template:**

```js
// Construct the preview HTML with real project tokens baked in
const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* paste extracted tokens here */
  :root { --color-primary: #...; --space-4: 16px; ... }
  body { margin: 0; font-family: ...; background: var(--color-surface, #fff); }
</style>
</head>
<body>
  <!-- paste the designed component HTML here -->
</body>
</html>`;

// Navigate to data URL and screenshot
await mcp__playwright__browser_navigate({ url: `data:text/html,${encodeURIComponent(html)}` });
await mcp__playwright__browser_take_screenshot({ fullPage: false });
```

**Rules:**
- Always use real token values — no placeholder colors or lorem spacing.
- Show all key states in one preview: default, hover (via CSS `:hover`), disabled, error.
- For mobile-first designs, set viewport to 390×844 before screenshotting; for desktop use 1280×800.
- If the user says "looks good" → proceed to step 4. If they give feedback → adjust and re-screenshot before writing final code.

### 4. Consistency check (mandatory before delivering)

After designing, verify:

| Check | Rule |
|---|---|
| Colors | Only token values — no raw hex/rgb in components |
| Spacing | Only token scale — no arbitrary px values |
| Typography | Only defined type scale — no one-off font sizes |
| Border radius | Consistent with existing radius tokens |
| Component naming | Matches existing naming convention in the project |
| States | All interactive states handled |
| Responsive | Works at mobile, tablet, desktop |
| Existing screens | New design doesn't visually clash with other screens |

If any check fails → fix before delivering.

### 5. Deliver

- Working code using the token system
- All states implemented
- A short note on any new tokens added (so the project's design system grows intentionally)

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Hardcoding `#3B82F6` | Use `var(--color-primary)` |
| Spacing with `mt-[13px]` | Use the nearest token (`mt-3` = 12px or `mt-4` = 16px) |
| New component that duplicates existing one | Extend the existing component with a variant |
| Designing in isolation | Always check adjacent screens for visual harmony |
| Skipping disabled/error states | All states are required, not optional |
| Adding a new font | Use the type scale already established |
| Skipping the visual preview | Always render and screenshot before finalizing — code without a preview leaves the user guessing |
| Using placeholder colors in the preview HTML | Extract real token values from the project and bake them into the preview |
| Delivering final code before user approves the preview | Preview → user feedback → iterate → then write final code |
