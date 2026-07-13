# Gotchas — hand-rolled Ouisys page architecture

Everything here was learned building a real page (GR "Mobiworld", MO flow) in
`xx-dynamic-template`. Each one cost real time to discover the first time.
Check every item before calling a build task done.

## Table of contents

1. [Never import from `ouisys-component-library`](#1-never-import-from-ouisys-component-library)
2. [`formatjs extract` silently prunes dynamic FormattedMessage ids](#2-formatjs-extract-silently-prunes-dynamic-formattedmessage-ids)
3. [Widget CSS scoping is required, not optional](#3-widget-css-scoping-is-required-not-optional)
4. [ICU number formatting for locale-correct decimals](#4-icu-number-formatting-for-locale-correct-decimals)
5. [Adding a `pageConfigs` flag is two edits, not three](#5-adding-a-pageconfigs-flag-is-two-edits-not-three)
6. [Flexbox `order` ranks ALL siblings, not just the ones you're thinking about](#6-flexbox-order-ranks-all-siblings-not-just-the-ones-youre-thinking-about)
7. [`translations/en.json` is a build artifact, not hand-authored](#7-translationsenjson-is-a-build-artifact-not-hand-authored)
8. [The widget reads `window.configJson`, not the `config` prop](#8-the-widget-reads-windowconfigjson-not-the-config-prop)
9. [Stable callbacks live at module scope](#9-stable-callbacks-live-at-module-scope)
10. [`pageConfigs` declares only a subset of images](#10-pageconfigs-declares-only-a-subset-of-images)
11. [`config.strategy` vs `flow` naming (R2)](#11-configstrategy-vs-flow-naming-r2)

---

## 1. Never import from `ouisys-component-library`

Some sibling repos in this template family (e.g. `gr-dynamic-template`) build
pages by hand-assembling that library's granular components (`Header`,
`TopLegals`, `SubscriptionArea`, `PageContent`, `CookieConsent`, etc.) around
their own flow-step components. `xx-dynamic-template`-style repos deliberately
do **not** — the pattern is hand-rolled host-page chrome (everything in
`Root.tsx` + `Main.scss`) wrapping the single `<SubscriptionWidget>` from
`ouisys-dcb-widget`.

This isn't just a style call. In the Mobiworld build, the repo's actual
`ouisys-component-library` dependency (`package.json` →
`file:../ouisys-component-library/dist`) turned out to be broken as
installed — it points at a raw build-output directory with no `package.json`
or `exports` map, so nothing importable from it resolves correctly even if
you wanted to use it. A well-formed copy exists transitively (pulled in by
`ouisys-dcb-widget` itself), which is enough to prove a *fix* is possible —
but fixing it is a project-wide dependency decision, not something to do
inside a page-build task. If a design brief seems to call for something that
library provides (a cookie-consent banner was the case that came up), the
right move is either to hand-roll it in `Root.tsx`, or to drop it from scope
and flag the gap to the user — not to "just import it."

**Before assuming this rule applies:** check the target repo's `Root.tsx` (or
equivalent) for how it currently mounts the widget. If it already imports
granular pieces from `ouisys-component-library`, you're in the *other*
architecture — this whole skill's file-level guidance won't fit, and you
should research that repo's actual pattern instead of forcing this one. See
"Detect which architecture you're actually in" in `SKILL.md`.

## 2. `formatjs extract` silently prunes dynamic FormattedMessage ids

The dev/build pipeline runs `formatjs extract` (via a `manage:translations`
or equivalent script), which does a **static source scan** for
`<FormattedMessage id="..." defaultMessage="..." />` calls. It can only see
`id`/`defaultMessage` values that are literal strings in the source. Any id
built dynamically is invisible to the scanner:

```tsx
// BREAKS silently — id and defaultMessage are computed, not literal
{ITEMS.map((item) => (
  <FormattedMessage id={item.id} defaultMessage={item.text} />
))}

// Also breaks — template-literal id
<FormattedMessage id={`step${n}`} defaultMessage={stepDefaults[n]} />
```

The component still renders fine (React doesn't care), but the English
source-of-truth translation file quietly loses that string on the next
build, and any other locale compiled from it drifts. Symptom: a translation
you know you added is missing after a rebuild, no error anywhere.

**Fix:** for every dynamic/computed `FormattedMessage` id, add a matching
entry to whatever file exists purely to anchor ids for the extractor (in
`xx-dynamic-template` this is `src/localization/widgetMessages.ts` — a file
that's declared but never imported at runtime, existing solely so the
extractor has a literal id to find):

```ts
export const widgetMessages = defineMessages({
  // ...existing entries...
  step1: { id: 'step1', defaultMessage: 'Enter your mobile number' },
  step2: { id: 'step2', defaultMessage: 'Confirm your PIN' },
});
```

This hit three separate sections independently while building the Mobiworld
page (a nav-links loop, a showcase image grid, a numbered steps list) before
it was made explicit — check every `.map()`-driven or template-literal
`FormattedMessage` id against this before calling a section done. Literal,
non-looped calls never need this.

## 3. Widget CSS scoping is required, not optional

If the host page renders its own widget headline and/or its own price/legal
line — which any page following this skill's pattern does — you must hide
the widget's *own* internal copies of that content, or the page will show
duplicates (a redundant "about to subscribe" line, a second price block, a
country flag/code the host didn't intend to show) once the widget actually
identifies a real subscriber. This is easy to miss because dev/demo harnesses
don't always trigger every one of these elements, so the page can look fine
in a quick check while shipping a duplicate.

```scss
.ouisys-subscription-widget {
  .price-point,
  .dynamic-price-point,
  .msisdn-secondary-label,
  .about-to-subscribe-text {
    display: none;
  }

  .flag,
  .country-code {
    display: none;
  }
}
```

Add this in the same task that writes the page's header/price/consent SCSS —
don't defer it. In the Mobiworld build this got missed across three separate
styling-adjacent tasks and was only caught by a final whole-branch review,
where it turned out to be hiding a real visible bug (a wrong country flag,
duplicated headline text), not a theoretical one.

## 4. ICU number formatting for locale-correct decimals

If a price or any numeric value gets interpolated into a translated string,
a bare ICU placeholder does NOT format for locale:

```json
// WRONG — {amount} stringifies the raw JS number, always with a period
"priceLine": "€{amount}/month"
```

`values={{ amount: 27.48 }}` renders `"€27.48/month"` even in a locale (e.g.
Greek, French) whose native convention is a comma decimal separator — and
if the surrounding text in that same string already hardcodes commas
elsewhere ("€2,29 each"), you get a jarring period/comma mismatch in one
sentence.

**Fix:** use ICU's `number` type in the message string itself — this tells
`react-intl` to format via `Intl.NumberFormat` for the active locale
automatically, no change needed at the call site:

```json
"priceLine": "€{amount, number}/month"
```

`Intl.NumberFormat('el').format(27.48)` → `"27,48"`.
`Intl.NumberFormat('en').format(27.48)` → `"27.48"`. Both correct,
automatically, per locale — better than hardcoding the value per-language,
since it stays correct if the underlying number ever changes.

## 5. Adding a `pageConfigs` flag is two edits, not three

Older docs in this template family describe a three-edit pattern (type +
a separate `localPageConfigs` defaults object + a `mapLiveConfig()` entry).
That's stale in repos using the operator-registry pattern (an
`OPERATORS` array of `{ id, label, pageConfigs, configOverrides? }`, one file
per operator under `src/configs/`) — there's no standalone defaults object;
the "default" for a flag simply *is* whatever the active operator's
`pageConfigs` sets, and the live-config merge already spreads `pageConfigs`
generically. The real two edits:

1. Add the field to the `IPageConfigs` type.
2. Set the value directly in the active operator's `pageConfigs` object.

Skip either and the flag silently doesn't exist (a type error, or
`undefined` → falsy at runtime).

## 6. Flexbox `order` ranks ALL siblings, not just the ones you're thinking about

If a page's main content column is one flat flex container holding both
"pinned" sections (steps, the widget itself, a price/info card) and
collapsible accordion sections as direct siblings, giving one accordion
`order: -1` to promote it above the *other accordions* on mobile will
promote it above **everything** in that flex container — including the
phone-input widget itself. CSS `order` sorts all direct flex children
together; it has no concept of "just the accordions."

If you want an accordion promoted above its sibling accordions but still
below the pinned content, give the pinned content its implicit `order: 0`,
the promoted accordion a small positive order (e.g. `1`), and the remaining
accordions a larger order (e.g. `2`) — don't reach for a bare negative order
unless you've confirmed there's nothing else in that same flex container you
don't want to move.

## 7. `translations/en.json` is a build artifact, not hand-authored

The English source of truth is the `defaultMessage` prop values in the JSX
itself. The pipeline extracts those into an `extractedMessages/en.json`
(often gitignored) and *compiles* that into `translations/en.json`. If you
hand-edit `translations/en.json` directly without also updating the
matching `defaultMessage` in the component, your edit survives only until
the next `manage:translations`/build run, which silently reverts it back to
whatever the JSX says. Other locale files (`fr.json`, `el.json`, etc.) are
usually genuinely hand-maintained — this trap is specific to whichever
locale the extraction pipeline treats as the source language.

**Rule of thumb:** if you need to change English copy, change the
`defaultMessage` prop in the component, not the JSON file. Non-source
locales are safe to hand-edit directly.

## 8. The widget reads `window.configJson`, not the `config` prop

The engine reads from `window.configJson` (set globally at module load,
before any React render). The `config` prop on `<SubscriptionWidget>` is for
host-side display convenience only. If you build a config object and pass it
as the prop but forget `window.configJson = ...`, the widget uses whatever
stale value happened to already be on `window` — often from a previous page
in the same dev session.

## 9. Stable callbacks live at module scope

`onConsentRequired`, `onSuccess`, `onEvent` handlers passed to
`<SubscriptionWidget>` should be declared as `const` at module scope (outside
any component), not inside the page component. The widget expects stable
referential identity across renders internally; declaring them inside a
component causes it to needlessly re-subscribe on every render.

## 10. `pageConfigs` declares only a subset of images

The typed config surface usually covers `logo`, maybe one hero/persuasive
image — but feature cards, showcase tiles, and operator cards on a real
source page carry images that live in plain `<img>` tags or
`background-image` CSS, **not** in any typed config field. If you only grep
the typed config for image fields you will ship with empty
Features/Showcase grids.

When replicating a page from a live URL, always run a DOM census after
rendering it via Playwright — enumerate `document.images` plus every element
whose computed `backgroundImage` isn't `none` — before declaring the image
inventory complete:

```js
const imgs = [...document.images].map(i => ({ src: i.src, alt: i.alt }));
const bgImgs = [...document.querySelectorAll('*')]
  .map(el => getComputedStyle(el).backgroundImage)
  .filter(bg => bg && bg !== 'none')
  .map(bg => bg.match(/url\("?(.+?)"?\)/)?.[1])
  .filter(Boolean);
```

Bundle content images locally (`src/assets/imgs/<brand>/`); logos can stay
CDN-referenced.

## 11. `config.strategy` vs `flow` naming (R2)

Same concept, two different naming conventions — never translate one side to
the other:

| Flow | `config.strategy` | `strategyConfigs.default.flow` |
|---|---|---|
| PIN | `'pin'` | `'pin'` |
| MO | `'mo'` | `'mo'` |
| MO redirect | `'mo-redir'` ← hyphen | `'moRedir'` ← camelCase |
| One-click / header enrichment | `'header-enrichment'` ← hyphen | `'oneClick'` ← camelCase |
| Click-to-SMS | `'click2sms'` | `'click2sms'` |
| USSD | `'ussd'` | `'ussd'` |
| Operator select | `'ask-operator'` | (set per-operator) |

**Never put camelCase in `config.strategy`.** The engine throws — usually
silently, or with an opaque `Unexpected state type: undefined` — and this is
the single most common first-time integration crash.
