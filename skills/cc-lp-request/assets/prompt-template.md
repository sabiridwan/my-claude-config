# LP request — paste-ready prompt template

Paste this as one message (to Claude, or into a CC Tasks ticket). Fill what you know; anything left
blank gets looked up from the panel or comes back as a named blocker — nothing gets guessed.
A complete prompt skips the whole interview and goes straight to ticket → build.

```
Create a new cc landing page:

1. Product / domain: <product name> / <domain.com>
2. Slugs (one per line, exactly as billing shows them — country suffix gets stripped):
   <cc_gateway-product1234_001->   <price>  <one-off | trial | subscription>
3. Gateway + bank: <celeris|maxpay|acquired|aci-pxp>, bank <NAME> (ID <n>)
4. Wallet identity:
   Apple Pay merchant identifier: <merchant.com.domain.N>   label: <domain.com>
   Google Pay (if on): gateway merchant ID <...>, Business Console merchant ID <BCR2DN...>, merchant name <domain.com>
5. Methods: <apple pay / google pay / card — which are on>
6. Deltas:
   country/d_country: <xx / nl>        currency: <EUR, local currency yes/no>
   MCC / legal entity: <name or "same as <product>">
   languages to verify: <en, de, ...>
   design: <match product site (default) | match page X | fresh design>
   trial days / billing cycle: <1 / 28>   (one-off: price in BOTH price fields, cycle 0)
   publish: staging only (default — Sabi publishes prod)
Requester: <who is asking — blockers go back to this person>
```

## Filled example (real shape)

```
Create a new cc landing page:

1. Product / domain: Files Editor / files-editor.com
2. Slugs:
   cc_acquired-fileseditor4999_001-   49.99  trial
3. Gateway + bank: acquired, bank acquired (ID 8)
4. Wallet identity:
   Apple Pay merchant identifier: merchant.com.files-editor.1   label: files-editor.com
   Google Pay: gateway merchant ID AGDS030924001, Business Console merchant ID BCR2DN4T6O6NPIB5, merchant name files-editor.com
5. Methods: apple pay + google pay + card
6. Deltas:
   country/d_country: xx / nl        currency: EUR, local currency yes
   MCC / legal entity: PEPPEROSE LIMITED
   languages to verify: en
   design: match product site
   trial days / billing cycle: 1 / 28
   publish: staging only
Requester: Sabi
```

## Minimal version (everything else derived or asked)

```
Create a new cc lp for <domain.com>, slug <...> at <price> <trial|one-off>,
gateway <x> bank <name/id>, same wallets/MCC as <sibling product>. Requester: <name>.
```

## What happens after you paste it

1. Panel looked up first (existing pages, MCC, template, siblings) — only genuine gaps asked back,
   one question at a time.
2. Ticket filed to Notion CC Tasks (shown to you first), unknowns marked `TBC — <owner>`.
3. Build → staging page + QA; every milestone lands on the ticket as a 📋 Update + comment.
4. You get: staging URL + panel edit URL. Production publish stays with Sabi.

## The values that ship wrong when rushed

- **Slug must NOT end in a country code** (`…_001-de` bills `…-dede`); keep the trailing hyphen.
- **One-off price goes in BOTH price fields** — the hidden trial-price field defaults to 0.01.
- **Apple Pay + Google Pay identity is domain-bound** — a sibling's IDs can fail live sessions.
- **Bank NAME ≠ gateway** — the name is a page-name token; pages don't rename, they get recreated.
- **Plan type in panel words**: `subscription` / `trial-then-subscription` / `one-off` — "not a
  subscription" prose has shipped renewal copy on one-off charges before.
