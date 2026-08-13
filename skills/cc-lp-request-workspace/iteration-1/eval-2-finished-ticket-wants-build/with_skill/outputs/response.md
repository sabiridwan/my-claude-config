I haven't created it — and I'd hold off even with panel access, because three of the values in the
signed-off ticket contradict what's live today. I checked the panel read-only before writing
anything.

**Gateway.** The ticket says `celeris`, but the slug is prefixed `cc_acquired-` and all twelve live
xrlab360 pages carry `"gateway": "acquired"`. The only page with `celeris` is a test page on an
`Acquired_test_service` slug. I can't resolve that from outside — a wrong gateway routes real money
to the wrong acquirer.

**Bank ID 42.** Every live xrlab360 page uses bank ID `8`, and the only IDs in the whole result set
are 7 and 8. `42` appears nowhere. Either it's a newly provisioned bank — in which case I still need
the bank *name*, since that's a token in the page name — or it's a transcription slip.

**Apple Pay identity is missing entirely**, on a page where Apple Pay is the only payment method. And
there's nothing safe to copy: production currently holds `merchant.com.xracademy.online.2` (borrowed
from a different product's domain) and `merchant.com.xrlab360.portal..acquired` (malformed, double
dot). Apple validates the identifier against the serving domain, so either one can fail live
sessions. That one's owned by whoever runs the Apple developer account.

Two smaller ones: the template `cc-dynamic-xrlab360-template-gcomp` v3 doesn't exist — the only
xrlab360 template is `cc-dynamic-xrlab360-template-download-nid-gcomp`, at v5. And the domain,
country, `d_country` default, MCC and page title aren't in the ticket at all.

Two things that *are* right and worth keeping: the slug is well-formed (ends at the hyphen, no
country suffix), and Google Pay is explicitly declared off rather than just omitted.

One thing to sanity-check with billing: nine live pages already run on
`cc_acquired-xrlab360portal5999_000-`, all trial-then-subscription at €49.99 / 28 days. This request
puts a €59.99 one-off on the same slug. Probably intended, but better confirmed now than in
reconciliation.

I've written up two files:

- `ticket-xrlab360-oneoff.md` — the ticket completed as far as the evidence allows, with the
  blockers and owners listed.
- `panel-create-plan.md` — every Card Create field in wizard order with the value to enter, marked
  ready / blocked, plus the panel evidence behind each conflict.

The plan already bakes in the one-off trap: Trial Price must be set to `59.99`, not left blank. The
panel hides that input for one-off plans but keeps its stored `0.01`, and the page reads it as the
charge amount — so an unchecked one-off ships as a one-cent charge. There's a post-save check for it
in the file, plus one for the `googlePay` block the panel writes even with the checkbox cleared
(confirmed live on an Apple-Pay-only xrlab360 page).

Get me the gateway, bank name + ID, and the Apple Pay merchant identifier, and the rest is
mechanical — `cc-ouisys-panel` creates it, `cc-dynamic-lp` handles the build and upload if a new
template version is needed.
