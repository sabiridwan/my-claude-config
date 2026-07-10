# zync-design previews — render before you finalize

Code without a preview leaves the user guessing. Design the screen, render it, get a yes, *then* write the real components. Iterating on a screenshot costs seconds; iterating on landed components costs a session.

## The loop

1. Extract the target repo's real tokens (colors, fonts, spacing) — the same ones `zyncgold.md` maps.
2. Build a self-contained HTML string with those values baked in.
3. Navigate Playwright to a `data:` URL containing it, screenshot, show the user.
4. Ask: *"Does this match what you had in mind?"* Feedback → adjust → re-screenshot. Approval → write final code.

## Template

```js
const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* Real tokens from tailwind.config / theme.ts — never placeholders */
  :root { --brand-accent: #C07D34; --space-4: 16px; /* … */ }
  body { margin: 0; font-family: Poppins, sans-serif; background: var(--brand-bg, #fff); }
</style>
</head>
<body>
  <!-- the designed component -->
</body>
</html>`;

// Mobile-first: 390×844. Desktop: 1280×800.
await mcp__plugin_playwright_playwright__browser_resize({ width: 390, height: 844 });
await mcp__plugin_playwright_playwright__browser_navigate({
  url: `data:text/html,${encodeURIComponent(html)}`,
});
await mcp__plugin_playwright_playwright__browser_take_screenshot({ fullPage: false });
```

The `mcp__plugin_playwright_playwright__*` prefix is the real namespace — plain `mcp__playwright__*` does not resolve.

## Rules

- **Real token values only.** Placeholder colors or lorem spacing make the preview a lie; you will approve a design you are not going to build.
- **Show every state in one frame** — default, hover (via CSS `:hover`), disabled, error. A preview of only the happy path hides the work that is actually left.
- Set the viewport before screenshotting: `390×844` for mobile-first, `1280×800` for desktop.
- Check the screenshot against the adjacent screens in the repo, not just against itself. A view can satisfy every token rule and still clash with the screen it sits next to.
- Do not deliver final component code before the user has approved a preview.
