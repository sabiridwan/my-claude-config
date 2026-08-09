# Notion queries — CC Tasks board

Every query here targets a **single** data source, which keeps it inside the
`available_with_limit` tier of `query_data_sources` on this workspace's plan.

## Fixed workspace facts

Defaults, not hard bindings. If a board URL is passed as an argument, re-derive the data source via
`notion-fetch` on that URL instead of assuming this schema.

| Fact | Value |
| --- | --- |
| Workspace | Sam Media — `553a3c4b-29e9-43cb-b7d3-fb7d8d9f1f5b` |
| User | Sabi Ridwan — `1a0d872b-594c-81d4-b503-0002bf4e9be6` |
| Board (database) | CC Tasks — `11fa5b097ae881689404d4140ed02533` |
| Data source | `collection://11fa5b09-7ae8-81cc-8081-000bc340da6c` |
| Open statuses | `Not Started`, `In Progress` |
| Complete statuses (exclude) | `Done`, `Archived`, `Not Applicable Anymore` |

**Confirm the user id against `notion-fetch` id `self` at the start of every run.** The value above
is a fallback for offline reasoning, not an authority.

Board scale at time of writing: **156** open tickets, **25** edited in the last 30 days, **9**
assigned to Sabi. These numbers are what make the two-tier pull necessary — re-measure them if a run
feels unexpectedly slow.

## Schema notes

Columns that matter, and their quirks:

| Column | Type | Note |
| --- | --- | --- |
| `Task Name` | title | |
| `Assignee` | person | JSON array of user ids — match with `LIKE '%<id>%'` |
| `Status` | status | Groups exist, but filter on the literal values above |
| `Priority` | select | `Low` / `Medium` / `High`, frequently null |
| `Tags` | multi_select | JSON array. Gateway names appear here (`Maxpay`, `Acquired`, `Apple Pay`) |
| `Project` | relation | JSON array of page URLs |
| `Blocked By` / `Is Blocking` | relation | Drives the "blocked on others" rank |
| `Created by` | created_by | **Who to ask** when a field is missing |
| `Due` | date | Query as `"date:Due:start"` — the bare name is not queryable |
| `Completed on` | date | Same expansion rule |
| `Delay` | formula | **Not queryable in SQL** (`notAvailableInQuerySql`) |
| `Description (don't use)` | text | Named that way for a reason. Ignore it. |

Date columns must be addressed through their expanded form (`date:<name>:start`), never the bare
property name. Normalize text timestamps with `datetime(...)` for comparisons.

## Tier A — assigned to me

```sql
SELECT url, "Task Name", Status, Priority, Tags,
       "date:Due:start" AS due, "Created time", "Last edited time",
       "Created by", "Blocked By", "Project"
FROM "collection://11fa5b09-7ae8-81cc-8081-000bc340da6c"
WHERE Assignee LIKE ?
  AND Status NOT IN ('Done','Archived','Not Applicable Anymore')
ORDER BY "Last edited time" DESC
```

Params: `['%1a0d872b-594c-81d4-b503-0002bf4e9be6%']` — use the id confirmed from `self`.

## Tier B — mention sweep candidates

```sql
SELECT url, "Task Name", Status, "Created by", "Last edited time"
FROM "collection://11fa5b09-7ae8-81cc-8081-000bc340da6c"
WHERE Status NOT IN ('Done','Archived','Not Applicable Anymore')
  AND (Assignee IS NULL OR Assignee NOT LIKE ?)
  AND datetime("Last edited time") >= datetime('now','-60 days')
ORDER BY "Last edited time" DESC
```

Params: `['%<user-id>%']`. Substitute the window from `--since`; `--since all` drops the
`datetime(...)` clause entirely.

Then, per candidate:

```
notion-get-comments { page_id: <id>, include_all_blocks: true }
```

Keep the ticket if any comment contains `user://<user-id>`. Most tickets return `{}` — comments are
sparse board-wide, so this sweep is cheaper in practice than the candidate count suggests.

## Coverage line

Record these while sweeping and print them at the top of the report:

```
Coverage: tier A <N> assigned · tier B swept <M> tickets (window <W>) · <K> mention hits
```

If tier B was skipped or shortened, the line must say so.

## Enrich call

```
notion-fetch { id: <ticket-id>, include_discussions: true }
```

Then follow `mention-page` links **one level deep** only. The links that matter:

- MID pages listed in a ticket table — carry the per-MID payment model and gateway detail
- The `Project` relation — carries the umbrella context
- A linked Portfolio ticket — a landing-page ticket often points at its portfolio counterpart

## The MID registry — where the checklist fields actually live

This is the highest-yield part of the whole skill. A ticket that lists MIDs as `mention-page` links
is not being vague — it is pointing at rows in a **MIDs** database that carry most of what the
checklists ask for.

| Database | Data source |
| --- | --- |
| MIDs | `collection://275a5b09-7ae8-80bc-9751-000b21f63f75` |
| Banks | `collection://275a5b09-7ae8-806d-8f0f-000b21d2d438` |
| Gateways | `collection://275a5b09-7ae8-802e-badc-000bc0546180` |
| MCC Codes | `collection://275a5b09-7ae8-8008-99a6-000b9dd6b76b` |
| Pricing | `collection://275a5b09-7ae8-807d-b674-000bf93b3545` |
| Products | `collection://275a5b09-7ae8-80b8-98bd-000b66744735` |
| Currencies | `collection://275a5b09-7ae8-804a-b6ca-000b079ba771` |
| Entities | `collection://275a5b09-7ae8-8098-9f34-000bb7d31b71` |

A MIDs row maps onto the checklists like this:

| MID property | Type | Checklist field it answers |
| --- | --- | --- |
| `Descriptor` | text | **domain** — e.g. `resumetuneai.com` |
| `MCC Code` | relation → MCC Codes | **MCC** |
| `Gateway` | relation → Gateways | **gateway** |
| `Bank` | relation → Banks | bank / acquirer context |
| `Pricing` | relation → Pricing | panel-runtime pricing, *not* a checklist field |
| `Products` | relation → Products | serviceId / serviceDisplayName context |
| `Status` | status | `Proposed` / `In Approval` / `Approved but Not Live` / `Live for Acquisition` / `Live with Limitations` / `Terminated` |
| `Portal URL` | url | |

**`Status` is a gating fact, not a nice-to-have.** A MID that is `In Approval` or `Proposed` means
the ticket is blocked on approval regardless of how complete its fields are. Surface it, and rank
that ticket **blocked on others** rather than actionable.

### Resolving the relations

Cross-data-source SQL requires an Enterprise plan; this workspace is metered, so **a JOIN is not
available**. Resolve in two hops instead:

1. Read the MID page (or SQL the MIDs data source) for the plain columns — `Descriptor`, `Status`,
   `Name`, `Portal URL`.
2. For each relation you need, `notion-fetch` the URL. **The value is the page title** — no body
   parsing required:
   - MCC Code → `7399 - Business Services (Not Elsewhere Classified)`
   - Gateway → `ACI`

**Cache every resolved relation URL for the whole run.** Relations are shared heavily — one Gateway
page backs all five PXP MIDs, so caching turns five fetches into one. Without the cache this step
dominates the runtime of a multi-MID ticket.

Fetch only the relations a checklist actually needs (MCC Code, Gateway, Bank, Products). Do not walk
Currencies, Entity, or Campaigns — nothing on any checklist reads them.

## Useful counts

Board health, for the report footer or for sanity-checking a slow run:

```sql
SELECT COUNT(*) AS open_total,
       SUM(CASE WHEN datetime("Last edited time") >= datetime('now','-30 days')
                THEN 1 ELSE 0 END) AS edited_30d
FROM "collection://11fa5b09-7ae8-81cc-8081-000bc340da6c"
WHERE Status NOT IN ('Done','Archived','Not Applicable Anymore')
```

## Fallback when metered

If `query_data_sources` reports the plan limit, use `query_database_view` (unmetered) against a
view, then filter in-process:

| View | URL | Filter |
| --- | --- | --- |
| Latest Tasks | `view://27ea5b09-7ae8-8028-9b5a-000ccf7827c9` | excludes Archived / Not Applicable |
| Active Tasks | `view://279a5b09-7ae8-809d-9bb9-000ca01b929d` | non-complete, or edited in last week |
| All | `view://11fa5b09-7ae8-811e-9a6f-000cf5d87476` | everything |

Note the fallback in the coverage line — view filters are not identical to the SQL above.
