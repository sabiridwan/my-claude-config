---
name: sam-cc-widget-lp-creator
description: Replicate a live cc-dynamic-*-template-gcomp "comp" landing page (Hero/ContentGrid/Features/HowToSubscribe/HeroPricing/HowToUnsubscribe/Footer, ouisys-engine strategy + Apple Pay/Google Pay hooks) into a target repo that currently looks different or was bootstrapped from an unrelated product. Use this whenever the user pastes a live product URL (e.g. a *.com/lp/<slug> or panel-hosted page) and says "change the design to this", "make our page match this", "replicate this page", "clone this design", or is working inside a cc-dynamic-*-template-gcomp repo and wants it to look like another live page. Do NOT use this for the Mouisys/DCB hand-rolled Root.tsx+Main.scss+SubscriptionWidget architecture (that's sam-dcb-widget-lp-creator) or for scaffolding a brand-new product from scratch via brand.config.json (that's cc-page/cc-designer) — this skill is specifically for porting a *proven working sibling repo's* page architecture into a repo that already exists but doesn't match the reference yet.
---

# Sam CC Widget LP Creator

## The core trick: the reference page tells you its own source repo

Every `cc-dynamic-*-template-gcomp` build embeds its own folder name into
every asset URL it emits:

```
/os-ui/static/<repo-folder-name>/files/<contenthash>.svg
```

(This comes straight from the shared webpack config's
`generator.filename: static/${page}/files/[hash].[ext]`, where `page`
is the source project's directory name.)

So before guessing at colors or rebuilding sections from a screenshot,
**inspect one image URL on the live reference page**. It hands you the
exact sibling repo on disk that produced it — turning "replicate this
design" from an open-ended rebuild into a mechanical port. This is the
single highest-leverage step in the whole process; don't skip it.

```js
// via Playwright browser_evaluate on the reference page:
() => Array.from(document.querySelectorAll('img'))
  .map(img => img.src)
  .find(src => src.includes('/static/'))
```

If the path is `/os-ui/static/cc-dynamic-template-download-nid-gcomp/files/...`,
that repo — almost certainly a sibling directory (`../cc-dynamic-*`,
`../cc-*`) — is your source of truth. Confirm it (don't just trust the
name match): grep its `src/localization/translations/en.json` for a
distinctive phrase from the reference page's copy. An exact string match
means this is the real source, not just a similar-looking sibling.

## Detect which architecture you're in — do this first

Read the target repo's `src/Root.tsx`.

- **This skill fits** if the reference's asset path points at a
  `cc-dynamic-*-template-gcomp`-style repo, and/or the target repo's
  `Root.tsx` already imports (or should import) `Hero`, `ContentGrid`,
  `Features`, `HowToSubscribe`, `HeroPricing`, `HowToUnsubscribe`,
  `Footer` from `./components/*`, wired through `ouisys-engine/strategy`
  + `useRootContext()`.
- **Does NOT fit** if the reference is a Mouisys-hosted DCB page
  (`c1.mouisys.com/<id>` or similar) — use `sam-dcb-widget-lp-creator`
  instead, a structurally unrelated hand-rolled architecture.
- **Does NOT fit** if there's no live reference at all and the ask is
  "spin up a brand-new product from scratch" — use `cc-page`/`cc-designer`,
  which scaffold via `brand.config.json` rather than porting a sibling.

If genuinely unsure which sibling repos exist on disk, `ls ..` from the
target repo — these templates are almost always checked out as siblings
under the same parent directory.

## Phase 0 — Confirm scope before touching payment code

Two things need the user's explicit sign-off before you write anything,
because they're expensive to get wrong and easy to get subtly wrong:

1. **Structural scope.** If the target repo's current section layout is
   fundamentally different from the reference (not just different colors —
   different *sections*), say so plainly and ask whether they want a full
   structural rebuild or just a re-theme of the existing layout. Don't
   assume "change the design" means "rebuild everything" — confirm it.

2. **Payment architecture.** Check how the target repo currently handles
   Apple Pay / Google Pay:
   - **Embedded widget pattern** — `<DynamicCCPay>` from
     `ouisys-widget-cc-pay` mounted inside one component, no
     `ouisys-engine/strategy` involved.
   - **Manual hook pattern** (what the `Hero`/`ContentGrid`/... component
     set needs) — `ouisys-engine/strategy` + `FLOWS.CreditCardFlow` +
     `useApplePayHandler`/`useGooglePayHandler`, `RootContext` exposing
     `showComp`, `isApplePayAvailable`, etc.

   If the target uses the widget pattern and the source repo uses the
   hook pattern (or vice versa), porting the reference's Hero means
   **swapping the entire payment integration**, not just visuals — this
   is real functional risk to code that moves money. Flag this explicitly
   and get the user to choose (full swap vs. keep current payment code
   and only restyle around it) before proceeding. Don't silently pick.

## Phase 1 — Diff the two repos' supporting infrastructure

Once you know the source repo, diff (don't just eyeball) these before
copying any components — most of the actual porting work is here, not in
the component JSX:

| Area | What to check |
|---|---|
| `src/providers/RootContext.tsx` | Usually cleanest to fully replace, not merge — the widget-pattern and hook-pattern contexts diverge enough that manual merging invites bugs. Diff first to be sure there's no target-specific field worth preserving. |
| `src/__doNotModify/includedFlows.tsx`, `includedReducers.tsx` | Despite the name, these need a couple of lines added (`CreditCardFlow` require, `creditCardFlowReducer` import) if the target never had the strategy engine wired up. Diff against source, apply just the delta. |
| `src/flows/CreditCardFlow/`, `src/hooks/`, `src/services/` | Often missing entirely in a widget-pattern repo. `yarn dev` will surface these fast via `Module not found` errors — don't try to enumerate them all upfront, copy the obvious ones then let the compiler tell you what's left. |
| `src/utils/` | `useApplePayHandler.ts`, `useApplePay.ts`, `useGooglePayHandler.ts`, `useGooglePay.ts`, `types.ts` — check which exist in target vs source. |
| `src/utils/configs.ts` | Diff, don't replace blindly — often the source is a strict superset (extra exports like `currencyMap`), safe to copy wholesale, but confirm nothing target-specific gets dropped. |
| `config.json` | Update `strategyConfigs.default.flowConfig.service` to match the target's own `src/assets/logos/<serviceId>.svg` filename. **Never touch `slug`** unless you have the real production value — it's payment-routing data, not cosmetic, and a wrong guess is a silent payment bug. |
| `src/assets/imgs/`, `src/assets/logos/` | Check what's already there before assuming you need to source new images. A repo bootstrapped from the canonical template often already has the full asset set (category icons, hero backgrounds, etc.) even though the currently-wired components don't use them yet — diff by filename/size against the source repo rather than re-downloading from the live reference. |
| `src/styles/_variables.scss`, `Root.scss` | Copy from source; note the target's old variables file may have brand-specific aliases other still-present old components depend on — resolve by removing those old components in the same pass (see Phase 2). |
| `src/localization/translations/*.json` | Copy all locale files wholesale from source (they're usually generic template content, not English-only) — but the authoritative content still comes from each component's `FormattedMessage defaultMessage`, since `yarn manage:translations` (Phase 3) regenerates `en.json` from whatever TSX you actually ship. |

## Phase 2 — Port the components

1. Copy the full comp-page component set from source:
   `Hero`, `ContentGrid`, `Features`, `HowToSubscribe`, `HeroPricing`,
   `HowToUnsubscribe`, `Footer`, plus whatever the flow needs
   (`ErrorModal`, `GooglePayButton`, `Creative`, `CreditCardStep`,
   `ClearPricing`, `PriceCopy`, `UserDetailsEntryStep`,
   `UserPaymentStatus`, `Loader`). Check for overlap with components the
   target already has (`Footer`, `Loader`, `Menu`, `AnimatedCtaLabel` are
   common ones) — diff them; usually the source version should win since
   it's the one the new Root.tsx composition actually expects.
2. Before deleting the target's old components, `grep` for their names
   across `src/` — confirm nothing outside `Root.tsx` still imports them.
   Old components in this architecture family are typically only ever
   imported from `Root.tsx`, so this check is usually fast and clean.
3. Rewrite `Root.tsx` to the source's composition (the `showComp` /
   `strategy()` / `FLOWS.CreditCardFlow` shape) rather than trying to
   graft new sections onto the old tree.
4. Fix hardcoded service-id fallbacks. These architectures often hardcode
   the *source product's* service id as a local-dev fallback, e.g.:
   ```ts
   const serviceId = window?.configJson?.pageConfigs?.service.id || 'xracademy';
   ```
   `grep -rn "<source-service-id>" src/` after copying and replace with
   the target's own id (matching its logo filename) — otherwise local dev
   silently shows the wrong brand.

## Phase 3 — Verify

1. `yarn manage:translations` — regenerates `en.json` from the ported
   TSX's `FormattedMessage` tags. Explicit `id="..."` props are preserved
   as-is; only messages without an explicit id get a hash id. This is why
   copying translation JSON files first and running extraction after is
   safe and correct, not redundant.
2. `yarn dev`, watch for `Module not found` — each one names exactly what
   Phase 1's infra diff missed (usually a hook, service, or util file).
   Fix and re-run rather than trying to preempt every dependency by
   reading every import chain up front.
3. Screenshot the local dev server (Playwright, full-page, matching
   viewport width to your reference screenshot) and compare section by
   section against the reference screenshot from Phase 0. Check the
   browser console too — `pageConfigs` fields that come from
   server-injected `window.configJson` (trial price, entity name,
   footer address) will legitimately show blank/undefined in bare local
   dev since there's no server injecting them; that's expected, not a
   regression, and matches how the source repo's own bare `yarn dev`
   behaves. Don't invent fallback data for these — only fix branding
   fallbacks that are wrong (see Phase 2 step 4).
4. `yarn build` (production) may prompt interactively (a `pre:build`
   release-prep script asking to confirm client/environment). Don't
   answer it blindly — you don't know what those answers actually commit
   to. Tell the user it needs a manual run rather than guessing.

## Gotcha: zsh doesn't word-split unquoted variables

If you're batching file copies with a shell loop, don't do this:
```bash
COMPONENTS="Hero ContentGrid Features"
for c in $COMPONENTS; do cp -R "$SRC/src/components/$c" "src/components/$c"; done
```
In zsh (the default on macOS, and this project's configured shell),
unquoted parameter expansion does **not** split on whitespace the way
bash does — the loop runs once with `c` bound to the entire string, and
`cp` fails with a confusing "No such file or directory" for a path that's
literally the whole component list mashed together. Use a literal
word list instead:
```bash
for c in Hero ContentGrid Features; do cp -R "$SRC/src/components/$c" "src/components/$c"; done
```

## After porting

Report back concretely, not just "done":
- What was ported vs. what was diffed-and-preserved from the target.
- The `config.json` `slug` caveat if you left it untouched (which you
  should have, absent a real production value).
- Whether `yarn build` was verified or still needs a manual interactive
  run.
- Any local-dev-only blank fields and why they're expected.
