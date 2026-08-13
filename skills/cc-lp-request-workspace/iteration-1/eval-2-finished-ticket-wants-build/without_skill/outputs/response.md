I didn't create it — I checked the five values against the panel first and three of them don't hold up. One is a hard blocker, so the page couldn't be created even if the rest were fine. (Also worth saying: I have no working browser session on panel.ouisys.com in this run, so I could only read the panel, not operate it.)

**The template doesn't exist.** `cc-dynamic-xrlab360-template-gcomp` returns 404 on S3 at v1, v2, v3 and v4, there's no local repo by that name, and the panel only knows `cc-dynamic-xrlab360-template-download-nid-gcomp` (template_id 231, latest v5). The probe is reliable — the same URL shape returns 200 for the template that does exist. My read is that the ticket wants the xrlab360 equivalent of `cc-dynamic-vreducationlab-template-gcomp` (same naming shape, and that's what the live celeris one-off pages run on, currently v4). That repo has to be built and uploaded before any page can point at it.

**The slug and the gateway contradict each other.** `cc_acquired-xrlab360portal5999_000-` is an Acquired slug — it's live right now on two Acquired pages (`x8mqm` and the intellectvr zerotrial page). Across 212 page configs I read, celeris pages use `cc_celerispay-…` 115 times out of 116; the one exception is an abandoned test page with the slug `cc_acquired-Acquired_test_service-`. Real celeris one-offs look like `cc_celerispay-docaihelp1999-` — celerispay prefix, no `_000` counter. So for this product/price I'd expect something like `cc_celerispay-xrlab360portal5999-`, but slugs come from billing, so I'm not inventing one.

**bankId 42 doesn't appear anywhere.** Observed celeris bankIds are 6, 4, 74, 173, 41 and 7. Acquired is always 8. The three current celeris one-off + Apple-Pay-only pages all use **173**. 42 could be a typo for 41, or it should be 173 — I can't tell which.

One more thing that isn't in the ticket but will bite: the one-off `plan` block itself is well established (`type: "one-off"`, `trialPrice == fullPrice`, `trialDays: 0`, `billingCycleDays: 0`), but the current xrlab360 build hard-codes subscription copy — "then 59.99 / monthly after the first period", "Per monthly after trial", and a `plan.trialDays || 1` that prints "Try for 1 day" even when trialDays is 0. On that build a 59.99 one-off would advertise a trial-and-subscription. That needs a code change in the new template, not just config.

Apple Pay only is fine — `paymentMethods: ["applepay"]`, exactly matching the one-off cohort.

Still unspecified: page name, MCC (Prizeflix B.V. id 4 vs PEPPEROSE LIMITED id 11 — they imply different Apple Pay labels and statement descriptors), Apple Pay merchantIdentifier and label, isLocalCurrency, and whether to publish or leave on staging.

I've written up the full evidence in `verification-findings.md` and a ready-to-paste config in `panel-config-draft.md` — everything verifiable is filled in, and the three contested fields are marked. Confirm the slug, the bankId, and which template you actually mean, and I'll build it and take it through to a staging URL.

For the record I left `xh44c` and `xpkti` alone, and made no writes to the panel.
