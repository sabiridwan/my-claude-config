---
name: sam-dcb-widget-lp-creator
description: Build or replicate an Ouisys/Mouisys DCB (direct-carrier-billing) subscription landing page in a repo that uses the hand-rolled React architecture (a single Root.tsx + Main.scss wrapping <SubscriptionWidget>, driven by an operator-registry of per-operator config files under src/configs/) — the pattern used by xx-dynamic-template and its per-page forks. Use this whenever the user wants to build, clone, replicate, or recreate a Mouisys-hosted page (they may give a c1.mouisys.com/<id> URL, a screenshot, or a design brief), add a new operator/country variant to an existing template repo, or asks to "make a new page" while working inside one of these repos. Do NOT use this for repos that build pages by importing granular components from ouisys-component-library (Header, TopLegals, SubscriptionArea, PageContent, etc.) directly — that's a different, older architecture (e.g. gr-dynamic-template) with a different playbook; check "Detect which architecture you're in" below before assuming this skill fits.
---

# Ouisys Landing Page Creator (hand-rolled React architecture)

Build/replicate a DCB subscription page in a repo shaped like
`xx-dynamic-template`: one `Root.tsx` component tree, one `Main.scss`
stylesheet, an operator-registry (`src/configs/registry.ts` +
`src/configs/<id>.ts` per operator/country), wrapping the single
`<SubscriptionWidget>` from `ouisys-dcb-widget`. Everything in this skill
was learned building a real page end-to-end (a Greek MO-flow page,
"Mobiworld") — the gotchas it references cost real time to discover once;
they shouldn't cost time again.

## Detect which architecture you're in — do this first

Before following any of the phases below, confirm the target repo actually
matches. Read its `Root.tsx` (or wherever the page tree is assembled) and
its `AGENTS.md`/README if present:

- **This skill fits** if `Root.tsx` imports `SubscriptionWidget` from
  `ouisys-dcb-widget` and renders host chrome (header, accordions, etc.)
  as plain hand-written JSX/SCSS, and there's a `src/configs/registry.ts`
  exporting an `OPERATORS` array.
- **This skill does NOT fit** if the page is assembled from
  `ouisys-component-library` components (`Header`, `TopLegals`,
  `SubscriptionArea`, `ProductArea`, `PageContent`, `Steps`, etc.) plus
  hand-written flow-step components (`PinFlow`, `IdentifyFlowByMsisdn`,
  etc.). That's a different, older pattern — don't force this skill's
  guidance onto it; research that repo's actual conventions instead
  (its own sibling repos are the best reference).
- **If genuinely unsure**, spend a few minutes checking a sibling repo or
  two before committing — an incorrect assumption here compounds through
  the whole build. This exact confusion happened once already; the fix
  was reading two sibling repos' actual `Root.tsx` files, not guessing
  from documentation alone.

## Phase 1 — Research the source

If there's a live Mouisys-hosted source URL, extract everything before
writing any code — the JSX is a React SPA, so raw HTML has no rendered
markup.

```bash
curl -s "https://c1.mouisys.com/<page-id>" -o /tmp/source.html
# Full configJson (country, strategy, pageConfigs, locale strings, etc.)
python3 -c "
import re, json
content = open('/tmp/source.html', encoding='utf-8').read()
m = re.search(r'window\.configJson\s*=\s*(\{.*?\});', content, re.DOTALL)
print(json.dumps(json.loads(m.group(1)), indent=2, ensure_ascii=False)) if m else print('NOT FOUND')
"
```

Then render it with Playwright — screenshot at mobile viewport (390×844),
and **expand every accordion/collapsed section** before reading the page
text, since collapsed content is invisible to a plain text dump:

```js
// after page.goto(sourceUrl) and resize to 390x844:
document.querySelectorAll('[class*="accordion"] label, details summary').forEach(el => el.click());
// then read document.body.innerText for the full transcribed content
```

Run the image census from `references/gotchas.md` (#10) — typed config
fields miss feature/showcase/operator images that live in plain `<img>` or
`background-image`.

From the screenshot, note for each section: background (solid/gradient/
image), header layout, hero presence, whether the widget sits in a card,
button shape/color, input shape, consent pattern (none / single checkbox /
double checkbox / toggle switch), legal/steps layout, footer structure.

## Phase 2 — Map source config → this repo's shape

Mouisys uses compound strategy strings; map to the widget's two-name
convention (gotcha #11 has the full table — the short version):

| Mouisys `strategy` | `config.strategy` | `flow` |
|---|---|---|
| `'pin'` | `'pin'` | `'pin'` |
| `'mo'` | `'mo'` | `'mo'` |
| `'mo-redir'` | `'mo-redir'` | `'moRedir'` |
| `'header-enrichment'` / `'one-click'` | `'header-enrichment'` | `'oneClick'` |
| `'click2sms'` | `'click2sms'` | `'click2sms'` |
| `'ask-operator'` / compound strategies | `'ask-operator'` | per-operator |

For `ask-operator`, operator keys are `{COUNTRY_UPPER}_{CARRIER}` (e.g.
`MY_MAXIS`, `SA_STC`) — determine which carrier uses which flow from the
source's legal text.

Extract from the source's `locale.<lang>` block: `msisdnLabel`,
`msisdnButton`, `pinLabel`, `moLabel`, price/legal text, opt-out
shortcode(s) and keyword, consent copy, and every accordion's title + body
text. This becomes the content for the operator config file and the
translation files — see `references/code-patterns.md` for the operator
config shape.

## Phase 3 — Confirm scope before writing code

Two decisions are usually the user's to make, not yours to assume:

1. **Fidelity** — full replica of every section, widget + essentials only,
   or just wiring a new operator config with no new page chrome? Ask if
   the request doesn't already make this clear.
2. **Where it lives** — a new branch off the repo's base/scaffold branch
   (keeps the scaffold generic), or directly on the current branch? If the
   base branch has running dev servers the user's actively using, a branch
   switch in-place will disturb them — flag this before switching.

If mid-research you discover the repo's actual architecture disagrees with
its own documentation (this happened: a sibling repo's real pattern didn't
match what the docs implied), or a planned dependency turns out broken or
forbidden (this happened with `ouisys-component-library` — see gotcha #1),
that's also worth surfacing before committing to a plan, not something to
silently route around.

## Phase 4 — Spec and plan

For anything beyond a one-file config tweak, don't skip straight to
editing `Root.tsx`. Use:

1. **`superpowers:brainstorming`** — turn the research into a concrete
   design: which sections, what content, what new `pageConfigs` flags,
   what images, what the architecture decision (Phase 3) implies for file
   structure. Write the design doc.
2. **`superpowers:writing-plans`** — turn the approved design into
   bite-sized, fully-specified tasks (real code in every step, not
   descriptions of code). One task per page section is a reasonable grain
   — each should be independently buildable and visually verifiable.

Self-review the plan against the gotchas below before calling it done —
several of them (dynamic ids, the two-edit flag pattern, ICU number
formatting) are the kind of thing that's cheap to design in up front and
annoying to retrofit.

## Phase 5 — Build

**`superpowers:subagent-driven-development`** is the recommended executor
for a multi-task plan like this: fresh subagent per task, a reviewer for
each, then a whole-branch review at the end. Two things worth doing
deliberately when running it for this kind of build:

- **Feed forward expensive discoveries.** If one task's implementer hits a
  gotcha not already in `references/gotchas.md` (or hits one of the listed
  ones in a new shape), fold it into the next dispatch's context instead of
  letting each later task rediscover it independently — this is the single
  biggest time-saver available. Consider adding genuinely new findings back
  into this skill's `references/gotchas.md` afterward.
- **Don't skip the final whole-branch review**, and use the strongest
  available model for it. No single task's scoped diff can catch
  cross-cutting issues — a locale-formatting bug, a missing widget-CSS-scoping
  block, a CSS rule that ranks against the wrong set of siblings — that only
  become visible with the whole page in view at once. In the Mobiworld
  build, the whole-branch review caught 4 real issues that 13 individual
  task reviews had all missed, because each was only looking at its own
  slice.

See `references/code-patterns.md` for proven shapes: operator config file,
the widget-area/consent-toggle wiring, the shared Accordion component, the
widget CSS scoping block, and the mobile-reorder pattern.

## Phase 6 — Known gotchas (read before building, not after)

Full detail with code in `references/gotchas.md`. Headlines, so you can
scan for relevance:

1. Never import from `ouisys-component-library` in this architecture — broken as installed, and not the intended pattern anyway.
2. `formatjs extract` silently prunes any `FormattedMessage` id that isn't a static literal string — every `.map()`-driven or template-literal id needs an extraction anchor.
3. Widget CSS scoping (`.ouisys-subscription-widget { .price-point, .flag, ... { display: none } }`) is required whenever the host renders its own headline/price line — easy to skip, hides real visible bugs when skipped.
4. Bare `{amount}` ICU placeholders don't locale-format numbers — use `{amount, number}`.
5. Adding a `pageConfigs` flag is two edits (type + active operator's config), not three.
6. Flexbox `order` ranks ALL direct siblings in a flex container — a promotion rule scoped to "just the accordions" can accidentally promote past pinned content too.
7. The build's source-language translation JSON is usually a compiled artifact, not hand-authored — edit the JSX `defaultMessage`, not the JSON, or your edit gets silently reverted.
8. The widget reads `window.configJson`, not the `config` prop — set the global explicitly.
9. Stable widget callbacks (`onConsentRequired`, `onSuccess`, `onEvent`) belong at module scope, not inside the page component.
10. Typed `pageConfigs` fields miss feature/showcase images that live in plain `<img>`/`background-image` — always DOM-census the source.
11. `config.strategy` uses hyphen-case, `strategyConfigs.default.flow` uses camelCase — never translate one into the other.

## Phase 7 — QA before calling it done

- `yarn typecheck` (or equivalent) clean.
- Both dev entry points (if the repo has more than one bundler config)
  render without console errors.
- Visual comparison against the source screenshot, section by section —
  expand every accordion and compare transcribed text, not just headings.
- Consent gating actually works: submitting with consent unchecked
  triggers the "scroll to consent" behavior; checking it and resubmitting
  doesn't crash.
- Mobile viewport (390px): no horizontal scroll, and if any section has a
  mobile-only reorder rule, confirm the *visual* order (bounding-rect
  check or a real screenshot), not just that the CSS rule exists.
- No leftover translation keys that nothing renders (an orphaned key is a
  sign a `defaultMessage` and its consuming JSX drifted apart).

## Reference files

- `references/gotchas.md` — full detail + code for every item in Phase 6, plus a couple more (images, module-scope callbacks, config prop vs window global) worth knowing even if they don't come up every time.
- `references/code-patterns.md` — proven code shapes: operator config file, widget-area/consent wiring, shared Accordion, widget CSS scoping, mobile-reorder CSS, dynamic-id extraction anchors.
