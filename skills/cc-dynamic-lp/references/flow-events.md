# Flow events — the DCB glossary, applied to cc-submit pages

Source of truth: the **Event Glossary** database in Notion
(`Event & Flow Glossary` → `Event Glossary`,
<https://app.notion.com/p/sammedia/80516480e0364bd19395319804a53ab4>). It was written for DCB
(PIN / MO / MSISDN / HE / Click2SMS) but it is the *house* event contract, not a DCB-only one —
the dashboards that read `Flow:advance:*` are the same ones a credit-card page reports into. A cc
page that invents its own vocabulary is invisible on them.

This file maps that glossary onto a card page and gives the exact calls to emit.

## The naming contract

Every client event reads `<Flow>:<verb>:<label>`:

| part | values |
| --- | --- |
| Flow | `PreFlow` (intent shown, no data yet) · `Flow` (in the flow proper) |
| verb | `advance` · `advance-auto` (fired by us, not the user) · `recede` (failure/step back) |
| label | the step, kebab-case |

Server-side events use `server:<label>`, `ui:<label>`, `bupper:hit:<label>`, `Impression:{…}` —
emitted by the platform, not by page code. Don't try to fire those from the page.

The DCB ladder for a single data-entry step is **four events plus a failure**, and this is the shape
to copy:

```
Flow:advance:msisdn-entry-started       user starts entering
Flow:advance:msisdn-entry-valid         a valid value is in the field
Flow:advance:msisdn-submitted           user submits
Flow:advance:msisdn-submission-success  backend accepted it
Flow:recede:msisdn-submission-failure   backend rejected it
```

`PreFlow:advance:step1` is defined as "When user clicks the prelander CTA and advance in flow" — the
CTA click *before* any data entry. On a card page that is the creative's / hero's CONTINUE button.

## Choosing the call: is this a step transition?

This is the whole decision, and it is not about how important the event feels:

| what happened | call | emits |
| --- | --- | --- |
| visitor moved **forward** one step | `advancedInFlow` / `advancedInPreFlow` | `advance` |
| **we** moved them forward, not the user | `advancedInFlow` with an `advance-auto` label | `advance-auto` |
| visitor moved **backward** a step | `recedeInFlow` | `recede` |
| **no step transition** — something happened *inside* a step | `customEvent` | your own category/action/label |

- **A failure is a recede, not a custom event.** A declined card returns the visitor to the step they
  came from, so `cc-form-submission-failure` is `Flow:recede:…`. Don't reach for `customEvent` just
  because nothing visibly navigates — the funnel position moved back, and that is the test.
- **`customEvent` is for activity within a step**: field focus, validation result, autofill, paste,
  language autodetect, a view. The visitor is in the same place before and after, so these must not
  ride `advance` — every stray `advance` inflates a funnel stage and makes the step-to-step
  conversion between real steps unreadable.
- **`advance-auto` exists so automatic progress doesn't read as user intent.** DCB uses it for
  `msisdn-detection-start` and the HE auto-submit — steps the page took on the visitor's behalf.

### The one open inconsistency — decide it deliberately

The glossary puts the **entire** entry ladder on `advance`, including
`Flow:advance:msisdn-entry-started` ("when a user starts entering msisdn") and
`…msisdn-entry-valid`. It treats each rung as a real forward step.

The cc repos do **not**: the card equivalents (`email-entry-started`, `email-valid`, `cc-cvv-valid`,
`cc-number-autofill`) are `customEvent`s on `user-details-entry-state` / `cc-form-state`. Read
strictly, a card page following the glossary would promote at least `entry-started` and `entry-valid`
to `Flow:advance:*`.

Both conventions are defensible — the ladder gives a finer funnel, the `customEvent` version keeps
`advance` to the four transitions a buyer actually makes. What is NOT defensible is doing it
differently per page. Today's shipped behaviour is the `customEvent` version, so **match that** and
raise the question rather than quietly promoting field events on one page: a page whose
`Flow:advance` count is two rungs higher than its siblings looks like better conversion, not a
different convention.

## The cc-submit funnel

Three user actions, each an `advance`, plus the field ladder and the failure paths. Reference
implementation live at `che.activenonline.com` (template `cc-activation-celeris-xracademy-nid`) —
when in doubt, walk that page and copy what it emits.

| # | user action | call | on the wire |
| --- | --- | --- | --- |
| — | page load | `tracker.sendOptInFlowEvent('Credit card')` | `get_sub_method` — **no advance** |
| **1** | entry CTA clicked | `tracker.advancedInPreFlow('step1')` | `PreFlow:advance:step1` |
| | | `tracker.customEvent('pre-user-details-entry-state', 'continue-clicked', 'continue-button')` | |
| **2** | email submitted | `tracker.advancedInFlow('user-details-entry-state', 'user-details-submission-success', { email })` | `Flow:advance:user-details-submission-success` |
| **3** | card form submitted | `tracker.advancedInFlow('tallyman.v1-credit-card', 'cc-form-submitted', { email })` | `Flow:advance:cc-form-submitted` |
| 3a | → gateway redirect | `advancedInFlow(…, 'cc-form-submission-success', { email, gateway_url })` | `Flow:advance:…` |
| 3b | → 3-DS challenge | `advancedInFlow(…, 'get-html-success')` | `Flow:advance:get-html-success` |
| 3c | → jslink | `advancedInFlow(…, 'load-script-start')` then `'load-script-success'` | |
| 3d | → declined / threw | `recedeInFlow(…, 'cc-form-submission-failure', { email, errorType, errorId })` + `recedeInFlow('Flow', 'payment-submission-failed')` | `Flow:recede:…` |

Field-level events (`email-entry-started`, `email-valid`, `cc-cvv-valid`, `cc-number-autofill`, …)
ride `customEvent`, category `user-details-entry-state` / `cc-form-state`. Those are the glossary's
`entry-started` / `entry-valid` rungs; they are NOT on the `Flow` funnel, so don't expect them in a
`Flow:advance` report.

### Page load is not step 1

`sendOptInFlowEvent` is the arrival marker and carries no flow/step pair, so it cannot serve as a
funnel step. Do **not** add an `advancedInFlow` on mount to stand in for one: the reference page
doesn't, and it double-counts on the gateway return, where the page loads again. If you do fire
anything on mount, gate it the way `Root.tsx` already gates the opt-in event:

```tsx
const isReturningFromGateway = React.useMemo(hasPaymentStatus, []);
useEffect(() => {
  if (isReturningFromGateway) return;   // the return trip is not a new funnel entry
  tracker.sendOptInFlowEvent('Credit card' as any);
}, [isReturningFromGateway]);
```

## The gotcha: `advancedInFlow`'s first argument is discarded

From `node_modules/pacman-client/.build-lib/Pacman/index.js`:

```js
var advancedInFlow = function advancedInFlow(flow, action, args) {
  var gaEvent = { category: "Flow", action: "advance", label: "".concat(action), args: args };
  sendFlowEvent(gaEvent);                        // `flow` is never read
};
var recedeInFlow = function recedeInFlow(flow, reason, args) {
  var gaEvent = { category: "Flow", action: "recede", label: "".concat(reason), args: args };
};
var advancedInPreFlow = function advancedInPreFlow(label, args) {
  var gaEvent = { category: "Pre-Flow", action: "advance", label: "".concat(label), args: args };
};
```

Consequences, all of which have bitten real pages:

- **The label is the only thing that identifies the event.** `advancedInFlow('Flow', 'x')` and
  `advancedInFlow('tallyman.v1-credit-card', 'x')` are byte-identical on the wire. Two calls with the
  same label are duplicates, not two series.
- **Passing a flow name buys nothing but readability.** Keep the existing repos' strings
  (`tallyman.v1-credit-card`, `user-details-entry-state`) for grep-ability; don't argue about them,
  and never rely on them reaching a dashboard.
- **`advancedInPreFlow` takes `(label, args)` — no flow argument.** It is the only one of the three
  that changes `category`, to `Pre-Flow`. Calling `advancedInFlow('Pre-Flow', 'step1')` does *not*
  produce `PreFlow:advance:step1`; it produces `Flow:advance:step1`.
- Comments in older repos claiming the two flow names let "dashboards keyed on either naming still
  read data" are wrong on the mechanism. Distinct labels are what keeps those events distinct.

## Verifying it, per page

Do this on the built page or the dev server before shipping — never infer from source. Walk the
funnel with real clicks (a synthetic `.click()` can latch a `busy` flag) and read GTM's dataLayer,
which holds the decoded `category`/`action`/`label`:

```js
(window.dataLayer || [])
  .filter(x => x && x.event === 'gaEvent')
  .map(x => `${x.category}:${x.action}:${x.label}`);
```

Expected after CONTINUE → email → card submit:

```
Pre-Flow:advance:step1
pre-user-details-entry-state:continue-clicked:continue-button
Flow:advance:user-details-submission-success
Flow:advance:cc-form-submitted
```

The raw pacman batch (`POST /analytickz/api/v2/mstore`, `content-type: text/plain`) carries the same
thing as `{"t":"flow_event","a":{"number":N,"category":…,"action":…,"label":…}}`, with `number`
giving the ordering. On localhost it 404s and on a non-registered origin it 400s — **the request
still fires, and that is the evidence you want**; a non-200 there is not a tracking bug.

## Gaps to check for on any page you touch

Each of these has shipped live on a cc page:

- **3-DS emits nothing outbound.** If `result.kind === 'html'` only calls `setThreeDsHtml(...)`, every
  3-DS charge that reached the gateway looks like drop-off while card redirects are counted. Fire
  `get-html-success`.
- **The gateway return emits nothing.** `UserPaymentStatus` renders success / decline /
  already-subscribed with no tracker call, so the outcome of every payment is missing client-side.
- **`Flow:advance:payment-submitted` on only one branch.** In several repos it fires on the redirect
  branch alone, not on `script` or `html` — so counting it as "reached gateway" undercounts by both.
- **The entry CTA emits nothing**, leaving no `PreFlow:advance:step1` and no way to separate "saw the
  creative" from "wanted to buy".
