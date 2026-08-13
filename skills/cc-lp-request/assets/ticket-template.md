# <Product / Bank> — Create Landing Page

Paste into the CC Tasks ticket. Mark anything unknown `TBC — <owner>` rather than leaving it blank,
so the gap and its owner are both visible.

**One MID = one page.** If the request covers several MIDs, repeat Block B and Block C per MID —
merchant identity is not shared between them.

## Block A — the whole request

Values that are genuinely true for every page in this request.

| Field | Value |
| --- | --- |
| Request covers (how many MIDs / pages) | |
| Template / git repo | |
| New build expected? | |
| Creative | |
| Target country | |
| `d_country` default | |
| Publish after creating? | |
| Existing pages to reuse or retire | |

## Block B — per MID

Repeat this block for each MID. The MID's own page in the MIDs database carries most of it —
`Descriptor`, `Bank`, `Gateway`, `Entity`, `MCC Code` — so link the MID page and fill from it.

| Field | MID 1 | MID 2 |
| --- | --- | --- |
| MID name (link the MID page) | | |
| Descriptor / domain | | |
| Gateway | | |
| Bank name | | |
| Bank ID | | |
| MCC / legal entity | | |
| Service ID | | |
| Service display name | | |
| Page title | | |
| Apple Pay merchant identifier | | |
| Apple Pay label | | |
| Supported card networks | | |
| Google Pay enabled? | | |
| Card Submit enabled? | | |

## Block C — per page (one row per billing slug, grouped under its MID)

| MID | Page name | Slug (no country) | Plan type | Price | Trial price | Trial days | Billing cycle | Currency | Local currency? | Force comp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | |
| | | | | | | | | | | |

## Blocking

- <field> — <who owns it>

## Results

Filled by the builder, one row per page.

| MID | Slug | Live page | Panel edit link |
| --- | --- | --- | --- |
| | | | |
