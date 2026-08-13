Ticket's written up — `ticket.md`, paste-ready for CC Tasks. You were away so I couldn't ask
anything; I filled the gaps from the panel and the repos and marked the rest `TBC — <owner>` rather
than guessing.

**Two things I changed in what you sent:**

1. **Dropped the `-de` off all three slugs.** They go in as `cc_acquired-smartpdfdesk2999_001-`,
   `cc_acquired-smartpdfdesk1999_002-`, `cc_acquired-smartpdfdesk999_003-`. The country is appended
   at runtime from `d_country`, so saving the `-de` gives you `...-dede` and a dead billing
   reference. This is what happened on CC-377 — four vreducationlab pages are live with it baked in.
   Every `cc_acquired-*` slug in the repos ends at the bare hyphen. I've set `d_country=de`; shout
   if that's wrong.

2. **Wrote the one-off price into the trial-price field too** (29.99 / 19.99 / 9.99 in both). The
   panel hides Trial Price on a one-off but still saves what was in it — default `0.01` — and the
   page reads that for the charge amount. Unstated, a €29.99 one-off ships as one cent.

**One thing worth double-checking: bank ID 88.** Every `acquired` page in the panel today uses bank
ID **8**. 88 might be a new record, but it's one keystroke from the existing one and a wrong bankId
routes to the wrong acquirer. Confirm it, and send the bank's *name* too — that's a token in the
page name, so the pages can't be named without it.

**Blocking, with owners:**
- Apple Pay merchant identifier + label for smartpdfdesk.com — Apple dev account owner. Nothing to
  copy here: page 1056 currently holds `merchant.com.docpilotai..acquired` (another product's, with
  a stray double dot) and the acquired sibling has the same defect. Apple validates it against the
  serving domain, so borrowing one can fail live sessions.
- Google Pay `gatewayMerchantId` + `merchantInfo` for the bank-88 MID — gateway/billing. You asked
  for GP on, so it needs its own credentials rather than Pepperose's.
- MCC / legal entity — billing. Can't infer it: your 5 aci-pxp smartpdfdesk pages are PEPPEROSE
  LIMITED (id 11), the existing acquired page is AMB Global Digital (id 5).
- Card Submit on or off, and publish vs leave staging — you.

**And a call I need from you: which repo builds these.** `cc-dynamic-smartpdfdesk-template-download-gcomp`
(template 251) has the smartpdfdesk.com design work but ACI-PXP payment code only — nothing that
talks to acquired. Either port the acquired payment path into it, or fork one of the acquired repos
(streamtrainfit/xrlab360) and re-brand. Both are in the ticket with the trade-offs.

Context I pulled while writing it: the 5 existing smartpdfdesk pages (1056–1060) are all still
`staging`, none published — I've listed them in the ticket with xcids and panel edit links, and
treated this request as 3 *new* pages that leave them untouched. Prices vs slug tokens
(2999/1999/999) all line up, so nothing to query there.

This is the requester side — ticket only, no page built. When it's unblocked, cc-dynamic-lp builds
and uploads and cc-ouisys-panel creates the pages.
