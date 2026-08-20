# Flow events — what the payment layer must emit

House event contract: the **Event Glossary** in Notion
(`Event & Flow Glossary` → `Event Glossary`,
<https://app.notion.com/p/sammedia/80516480e0364bd19395319804a53ab4>). Written for DCB
(PIN / MO / MSISDN / HE), but `Flow:advance:*` is read by the same dashboards a card page reports
into, so a checkout that invents its own vocabulary is invisible on them. cc-dynamic-lp owns the
page-level funnel; **this skill owns everything from the card submit onward**, which is where the
gaps have actually shipped.

## Naming contract

`<Flow>:<verb>:<label>` — `PreFlow` (intent shown, no data yet) or `Flow` (in the flow proper);
verb `advance` · `advance-auto` (fired by us, not the user) · `recede` (failure/step back); label
kebab-case. Server-side `server:*` / `ui:*` / `Impression:{…}` are platform-emitted — never fire
those from page code.

The DCB ladder for one data-entry step, which is the shape to copy:

```
Flow:advance:msisdn-entry-started → entry-valid → submitted → submission-success
Flow:recede:msisdn-submission-failure
```

## Choosing the call: is this a step transition?

That is the entire decision — not how significant the event feels:

| what happened | call |
| --- | --- |
| visitor moved **forward** one step | `advancedInFlow` / `advancedInPreFlow` |
| **we** moved them forward, not the user | `advancedInFlow` with an `advance-auto` label |
| visitor moved **backward** a step | `recedeInFlow` |
| **no step transition** — something inside a step | `customEvent` |

- **A failure is a recede.** A decline returns the visitor to the step they came from, so
  `cc-form-submission-failure` and `payment-submission-failed` are `Flow:recede:…`. Nothing has to
  visibly navigate for that to be true — the funnel position moved back, and that's the test.
- **`customEvent` is for activity within a step**: field focus, validation, autofill, paste, a view
  (`noncomp_view`). Same funnel position before and after. Every stray `advance` inflates a stage and
  ruins the step-to-step conversion between the real steps.
- **Field events stay `customEvent` on card pages — settled, do not promote them.** The DCB glossary
  puts its whole entry ladder on `advance` (`msisdn-entry-started`, `-entry-valid`); card pages
  deliberately diverge. `email-entry-started`, `email-valid`, `cc-cvv-valid`,
  `cc-card-number-valid`, `cc-number-autofill`, `copy-pasted` and friends ride `customEvent` on
  `user-details-entry-state` / `cc-form-state`. Ratified 2026-08-19, matching every shipped cc page.
  `advance` is reserved for the transitions a buyer makes — CTA → email → card submit → outcome — so a
  page whose `Flow:advance` count sits two rungs above its siblings reads as better conversion rather
  than a different convention.

## What this skill's templates emit

| moment | file | call |
| --- | --- | --- |
| non-comp creative tapped | `components/NonComp.tsx` | `advancedInPreFlow('step1')` + `customEvent('pre-user-details-entry-state','continue-clicked','continue-button')` |
| card form submitted | `components/CardForm.tsx` | `advancedInFlow(CC_FLOW, 'cc-form-submitted', { email })` |
| → redirect / success | `payments/cardService.ts` | `advancedInFlow('Flow','payment-submitted')` + `advancedInFlow(CC_FLOW,'cc-form-submission-success',{ gateway_url })` |
| → 3-DS `html` | `payments/cardService.ts` | `advancedInFlow(CC_FLOW, 'get-html-success')` |
| → `jslink` | `payments/cardService.ts` | `advancedInFlow(CC_FLOW,'load-script-start',{ gateway_url })` |
| → script loaded / failed | `components/CardForm.tsx` | `advancedInFlow(CC_FLOW,'load-script-success')` / `recedeInFlow(CC_FLOW,'load-script-failure')` |
| → declined | `payments/cardService.ts` | `recedeInFlow('Flow','payment-submission-failed')` + `recedeInFlow(CC_FLOW,'cc-form-submission-failure',{ errorType, errorId })` |

`CC_FLOW` is `'tallyman.v1-credit-card'`.

### The outcome events live in `handleCardResult`, not in the component

This is deliberate and worth preserving. `handleCardResult` is the single choke point through which
every outcome passes, so putting the events there makes "every branch emits exactly one event" true
*by construction*. When the outcome events live in the component instead, the branches nobody
manually tests — 3-DS and `jslink` — end up emitting nothing, and a charge that reached the gateway
reads as drop-off while a plain redirect is counted. That has shipped live more than once.

The submit event (`cc-form-submitted`) stays in the component and fires **before** the request, so an
attempt is counted even if the call never returns. It is the denominator every outcome is measured
against.

## The gotcha: `advancedInFlow`'s first argument is discarded

From `node_modules/pacman-client/.build-lib/Pacman/index.js`:

```js
var advancedInFlow = function (flow, action, args) {
  var gaEvent = { category: "Flow", action: "advance", label: "".concat(action), args: args };
};                                                  // ^ `flow` is never read
var recedeInFlow = function (flow, reason, args) {
  var gaEvent = { category: "Flow", action: "recede", label: "".concat(reason), args: args };
};
var advancedInPreFlow = function (label, args) {     // no flow argument at all
  var gaEvent = { category: "Pre-Flow", action: "advance", label: "".concat(label), args: args };
};
```

- **The label is the event's entire identity.** Two calls with the same label are duplicates, not two
  series, regardless of the flow string.
- **`advancedInPreFlow` is the only one that changes `category`** (to `Pre-Flow`).
  `advancedInFlow('Pre-Flow','step1')` yields `Flow:advance:step1` — wrong event.
- Keep passing a flow name for grep-ability; never rely on it reaching a dashboard.

## Which tracker

Prefer `ouisys-engine/utilities/tracker` — the real Pacman client, wired to GTM and Tau — whenever the
target repo has it. See the non-negotiable about never swapping it out.

This skill's own `payments/tracker.ts` posts directly to the mstore endpoint above (not through the
engine tracker) — an earlier version posted to `/api/v1/frontend/track`, confirmed **404 on staging
AND production** across three independently-shipped pages, silently dropping every event. Its
method names and argument order still mirror the engine tracker exactly
(`customEvent` / `advancedInPreFlow` / `advancedInFlow` / `recedeInFlow`, flow-first), so component
code reads identically either way and switching is a one-line import change. The `_flow` parameters
are underscore-prefixed there to document that they are intentionally unused.

## Verify per page — never infer from source

Walk the funnel with **real clicks** (a synthetic `.click()` can latch the `busy` flag and make the
next real click a no-op) on the built page or dev server, then read GTM's dataLayer:

```js
(window.dataLayer || []).filter(x => x && x.event === 'gaEvent')
  .map(x => `${x.category}:${x.action}:${x.label}`);
```

The raw batch (`POST /analytickz/api/v2/mstore`, `content-type: text/plain`) carries the same as
`{"t":"flow_event","a":{"number":N,"category":…,"action":…,"label":…}}`; `number` gives ordering. On
localhost it 404s and on an unregistered origin it 400s — **the request still fires, and that is the
evidence**. A non-200 there is not a tracking bug.

To reach the 3-DS and `jslink` branches without a real charge, stub `handleCardResult`'s input rather
than hunting a card that triggers them:

```js
import { handleCardResult } from './payments/cardService';
handleCardResult({ success: true, method: 'html', html: '<form/>' }, {});      // get-html-success
handleCardResult({ success: true, method: 'jslink', gateway_url: '/x.js' }, {}); // load-script-start
```

## Known gaps this skill does NOT yet close

- **The gateway return emits nothing.** The `payment-status` result screens (success / decline /
  already-subscribed) carry no tracker call in any template, so the final outcome of every payment is
  missing client-side. Whoever owns the result screen should add it.
- **Field-level rungs are `customEvent`, not `Flow:advance`.** `email-entry-started`,
  `cc-cvv-valid`, `cc-number-autofill` and friends ride `user-details-entry-state` /
  `cc-form-state`. That matches the existing repos, but it means they will not appear in a
  `Flow:advance` funnel report — don't go looking for them there.
