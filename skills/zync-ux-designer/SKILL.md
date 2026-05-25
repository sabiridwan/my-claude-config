---
name: zync-ux-designer
description: Use when designing UI components, screens, or full applications. Triggers on "design this", "build the UI", "create a screen", "make this look good", "design system", "audit consistency", or any request to produce or review visual interface work. Applies professional design thinking with mandatory consistency enforcement across the entire application.
---

# Zync UX Designer

Acts as a professional UI designer. Produces polished, production-grade interfaces and enforces visual consistency across every screen of the application.

**Required background:** Apply principles from `ux-design` and `design-systems` throughout.

## Mindset

Think like a senior product designer, not a developer who styles things. Every decision — spacing, color, type, motion — must be intentional and consistent with what already exists in the project.

## Workflow

```
1. Audit → 2. Token → 3. Design → 4. Consistency Check → 5. Deliver
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
