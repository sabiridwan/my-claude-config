# Smart PDF Desk — Create Landing Pages (3 one-off slugs, Acquired, DE)

Three new one-off billing slugs on `smartpdfdesk.com`, gateway **acquired**, bank ID **88**,
Apple Pay **and** Google Pay enabled.

Everything not supplied by the requester is marked `TBC — <owner>`. Do not fill a TBC by copying
another page's value; every one of them is a merchant identity or a legal entity.

---

## Block A — applies to all three slugs

| Field | Value |
| --- | --- |
| Product domain | `smartpdfdesk.com` |
| Target country | Audience **DE**. Panel `country` field: keep **XX** — all 5 existing smartpdfdesk pages are XX, and XX + `d_country` is how this domain already runs. |
| `d_country` default | `de` |
| Gateway | `acquired` — inferred from the `cc_acquired-` slug prefix, please confirm. **Note: the 5 existing smartpdfdesk pages are `aci-pxp`.** This is a second gateway on the same domain, not a change to those. |
| Bank name | **TBC — billing team.** Needed as a token in the page name. See "Confirm before build" #2. |
| Bank ID | `88` — stated by requester. **Confirm 88 and not 8**: every `acquired` page in the panel today uses bankId `8`. |
| MCC / legal entity | **TBC — billing team.** Cannot be inherited: the 5 smartpdfdesk aci-pxp pages use *PEPPEROSE LIMITED* (id 11), while the existing `acquired` page uses *AMB Global Digital Solutions LTD* (id 5). Which entity owns bank 88's MID? |
| Service ID | `smartpdfdesk` (proposed — the 3 slugs are one product, not 3 MIDs like the aci-pxp set) |
| Service display name | `Smart PDF Desk` (spelling taken from the product site, `dmb-portfolios/sites/smartpdfdesk`) |
| Page title | `Smart PDF Desk` |
| Apple Pay merchant identifier | **TBC — Apple developer account owner.** Must be issued for `smartpdfdesk.com`. See "Confirm before build" #3 — there are two malformed inherited values already in the panel; neither is usable. |
| Apple Pay label | **TBC** — suggest `smartpdfdesk.com`. (`label` is empty on all 5 existing smartpdfdesk pages.) |
| Supported card networks | Proposed `visa, masterCard, maestro` (matches all 5 existing smartpdfdesk pages) — **confirm the bank-88 MID actually supports maestro.** |
| Google Pay enabled? | **YES** — explicitly requested. Requires `payments.googlePay.gatewayMerchantId` + `merchantInfo.merchantId` / `merchantName` for **this** MID — **TBC — gateway/billing team.** |
| Card Submit enabled? | **TBC — requester.** Assumed **yes** (all 5 existing smartpdfdesk pages carry `ccsubmit`). If it is wallets-only, say so — omitting it silently drops the card form. |
| Template / git repo | **Decision needed — see "Confirm before build" #5.** Existing repo `cc-dynamic-smartpdfdesk-template-download-gcomp` (panel template id **251**, current version v4) carries **ACI-PXP payment code only**. Acquired-gateway payment code lives in `cc-dynamic-xrlab360 / streamtrainfit / omnilearnhub-template-download-nid-gcomp`. |
| New build expected? | **Yes** — no existing build serves `acquired` on this brand, whichever repo route is chosen. |
| Creative | `download`, comp — matches the smartpdfdesk precedent. Confirm if non-comp is also wanted. |
| Publish after creating? | **TBC — requester.** Note the 5 existing smartpdfdesk pages are all still `staging`; those MIDs were "Approved but Not Live". Is bank 88's MID live? |
| Existing pages to reuse or retire | 5 pages exist on this domain (all staging, none published). See table below — none of them should be edited for this request; these are 3 **new** pages. Confirm the 5 stay as they are. |

### Existing smartpdfdesk pages (for context — leave alone unless told otherwise)

All on template `cc-dynamic-smartpdfdesk-template-download-gcomp` (id 251), gateway `aci-pxp`,
MCC 11 PEPPEROSE LIMITED, bankId 4, status `staging`.

| id | xcid | slug | plan | Live URL (after publish) | Panel edit |
| --- | --- | --- | --- | --- | --- |
| 1056 | xd6b0 | `cc_acipxp-resumetuneai-` | 0.01/1d → 49.99/28d | https://smartpdfdesk.com/lp/xd6b0 | https://panel.ouisys.com/dynamic-pages/update-credit-card/1056 |
| 1057 | xhifi | `cc_acipxp-pdfdoccraft-` | one-off 24.99 | https://smartpdfdesk.com/lp/xhifi | https://panel.ouisys.com/dynamic-pages/update-credit-card/1057 |
| 1058 | xd6cc | `cc_acipxp-nestifyskills-` | 0.01/1d → 29.99/28d | https://smartpdfdesk.com/lp/xd6cc | https://panel.ouisys.com/dynamic-pages/update-credit-card/1058 |
| 1059 | xm0lp | `cc_acipxp-fitloom-` | 0.01/1d → 29.99/28d | https://smartpdfdesk.com/lp/xm0lp | https://panel.ouisys.com/dynamic-pages/update-credit-card/1059 |
| 1060 | xd6do | `cc_acipxp-talentyai-` | one-off 24.99 | https://smartpdfdesk.com/lp/xd6do | https://panel.ouisys.com/dynamic-pages/update-credit-card/1060 |

---

## Block B — one row per billing slug

| Page name | Slug (no country) | Plan type | Price | Trial price | Trial days | Billing cycle | Currency | Local currency? | Force comp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `xx-cc-smartpdfdesk-2999-applepay-googlepay-acquired-download-oneoff-gcomp-dyn` | `cc_acquired-smartpdfdesk2999_001-` | one-off | 29.99 | **29.99** | 0 | 0 | EUR | no | no |
| `xx-cc-smartpdfdesk-1999-applepay-googlepay-acquired-download-oneoff-gcomp-dyn` | `cc_acquired-smartpdfdesk1999_002-` | one-off | 19.99 | **19.99** | 0 | 0 | EUR | no | no |
| `xx-cc-smartpdfdesk-999-applepay-googlepay-acquired-download-oneoff-gcomp-dyn` | `cc_acquired-smartpdfdesk999_003-` | one-off | 9.99 | **9.99** | 0 | 0 | EUR | no | no |

Page names are provisional: they follow this domain's own precedent
(`xx-cc-smartpdfdesk-<mid>-acipxp-download-gcomp-dyn`) with the gateway token swapped and the price
used as the distinguishing token, since all three pages are the same product. If a **bank name**
token is wanted it slots in right after `xx-cc-` — which is the other reason bank 88's name is
needed before the pages are created. Page names are globally unique, so settle them first.

---

## Confirm before build

**1. Slugs are corrected — the `-de` has been stripped.** Submitted as
`cc_acquired-smartpdfdesk2999_001-de`; saved as `cc_acquired-smartpdfdesk2999_001-` (same for the
other two). The country is appended at runtime from `d_country`, so saving the `-de` version
produces `...-dede` and a broken billing reference. Billing systems display the country as part of
the reference, which is exactly why it gets copied in — no fault, but it has bitten us: on CC-377
four vreducationlab pages went live with the country saved verbatim. Every existing `cc_acquired-*`
slug in the codebase ends at the bare hyphen (`cc_acquired-xrlab360portal5999_000-`), which is the
shape to match. **Please confirm `d_country=de` is the intended default.**

**2. Bank ID 88 vs 8.** Stated as 88. Every `acquired`-gateway page currently in the panel uses
bankId **8**. 88 may be a genuinely new bank record, but it is one keystroke away from the existing
one, and a wrong bankId routes the payment to the wrong acquirer. Confirm the number **and** send
the bank's name.

**3. Apple Pay identity must be issued for this domain.** No usable value exists to copy. What is in
the panel today is already broken: smartpdfdesk page 1056 holds
`merchant.com.docpilotai..acquired` (another product's, with a double dot) and the existing acquired
page holds `merchant.com.xrlab360.portal..acquired`. Apple validates the merchant identifier against
the serving domain during merchant validation, so an inherited one can fail live sessions. This is a
real blocker owned by whoever holds the Apple developer account.

**4. Google Pay is on, so it needs its own credentials.** `gateway: "acquired"` plus a
`gatewayMerchantId` and `merchantInfo` for **bank 88's MID**. The values sitting on sibling pages
(`gatewayMerchantId: 019aa163-…`, `merchantId: BCR2DN7TZDOZPMZP`) belong to Pepperose's MID — reuse
them only if billing confirms this MID is the same one.

**5. Which repo builds these?** Two routes, and it changes the estimate:
   - **(a)** Add the acquired payment path to `cc-dynamic-smartpdfdesk-template-download-gcomp`
     (keeps one repo and the smartpdfdesk.com design work already done; needs the acquired
     card/wallet services ported in from the xrlab360/streamtrainfit repos, and a new template
     version on template 251).
   - **(b)** Fork an acquired repo (e.g. `cc-dynamic-streamtrainfit-template-download-nid-gcomp`)
     and re-brand it to smartpdfdesk (payments work day one; the pdfsmart-derived design tokens and
     the en/de/es copy set have to be brought across, and a new panel Template is needed).

**Consistency check that passed:** the price tokens in the slugs (`2999`, `1999`, `999`) match the
stated prices, and the `_001/_002/_003` sequence is clean — nothing to query there.

---

## Blocking

- Apple Pay merchant identifier + sheet label for `smartpdfdesk.com` — Apple developer account owner
- Google Pay `gatewayMerchantId` + `merchantInfo` for the bank-88 MID — gateway/billing team
- Bank **name** for bank ID 88, and confirmation that it is 88 and not 8 — billing team
- MCC / legal entity for the bank-88 MID — billing team
- Repo route (a) or (b), and the page-name shape once the bank name lands — requester/builder
- Card Submit on or off; publish immediately or leave staging — requester

---

## Filled in by the builder

| Slug | Live page | Panel edit link |
| --- | --- | --- |
| `cc_acquired-smartpdfdesk2999_001-` | | |
| `cc_acquired-smartpdfdesk1999_002-` | | |
| `cc_acquired-smartpdfdesk999_003-` | | |
