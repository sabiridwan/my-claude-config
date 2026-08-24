# Filing the ticket into Notion

The CC Tasks board is where these requests live. Filing directly saves the requester a copy-paste
and keeps the ticket's shape consistent, but it is a write into a shared workspace — see the
confirmation rule at the bottom, which is not optional.

## Target

| Thing | Value |
| --- | --- |
| Board | **CC Tasks** |
| Data source id | `collection://11fa5b09-7ae8-81cc-8081-000bc340da6c` |
| Board URL | https://app.notion.com/p/11fa5b097ae881689404d4140ed02533 |

Create with the Notion MCP `create-pages` tool, passing that data source as the parent. If no Notion
MCP server is connected, say so and hand back the markdown for the requester to paste — do not
pretend the ticket was filed.

## Properties

Set only these. Everything else is system-managed or deliberately unused.

| Property | Type | What to set |
| --- | --- | --- |
| `Task Name` | title | `<Product> - Create Landing Page`, matching the board's existing phrasing |
| `Status` | status | `Not Started` for a new request. Options: `Not Started`, `In Progress`, `Not Applicable Anymore`, `Done`, `Archived` |
| `Priority` | select | `Low` / `Medium` / `High` — only if the requester states urgency; otherwise leave empty rather than inventing one |
| `Tags` | multi_select | Pick from the existing options only. Useful ones here: `Apple Pay`, `Acquired`, `Maxpay`, `Compliance`, `tech`. Never create new options |
| `Assignee` | person | Leave empty unless the requester names someone — it needs a Notion user id, and guessing assigns work to the wrong person |
| Requester | person / text, **if the board has such a property** | Set it to the requester from Block A. Read the board's live schema before filing rather than assuming the property exists or its type; if it's a `person` you need the Notion user id, and the same rule as `Assignee` applies — never guess one. If there is no such property, or you can't resolve the id, leave it and let the Block A row in the body carry it |
| `Project` | relation | Only if the requester gives the project page; it points at a different data source |

**Do not touch:** `ID` is an auto-increment (it becomes `CC-###` by itself), and `Created by`,
`Created time`, `Last edited time`, `Delay` are system-managed. Note `Created by` records **whoever
filed the ticket** — which is you, or the assistant's account, not necessarily the requester. It is
not a substitute for the requester field; that's why the requester is written into Block A of the
body regardless of what the board's properties support. **Do not use
`Description (don't use)`** — the property name is the instruction. The ticket body goes in the page
content.

## Page content

Put the ticket itself in the page body as markdown, in the same shape as
`assets/ticket-template.md`: a `## Description and Why` heading, Block A, Block B, then the blockers
list. Existing tickets on this board lead with `## Description and Why` and a table, so matching that
means whoever opens it reads what they expect.

Leave a `## Results` section empty at the bottom. The builder fills it with the live page URL and the
panel edit link per page — that's the convention the board already follows.

## The confirmation rule

Creating a page on CC Tasks is visible to the whole team and notifies watchers. So: **draft the
ticket in the conversation first, show the requester exactly what will be created — title, status,
tags, and the body — and only create it after they say yes.**

This is not ceremony. A half-complete ticket filed under a real CC number gets picked up by a
builder who assumes the missing fields were considered and omitted deliberately. Better to hold it
in the conversation until the requester has looked at the blockers list and confirmed they want it
filed with those gaps visible.

Never file a ticket the requester has not seen, and never fill a blocker with a plausible value to
make the ticket look complete.

After creating, hand back the page URL so they can watch it.

## Progress comments — every update lands on the ticket

Once the ticket exists, it is the single thread of record. **Every milestone and every change gets
a `notion-create-comment` on the ticket page**, attributed to the requester the work was done for:

```
[<stage>] <what happened> — for <requester>
<links / ids>
```

Post one comment per event, at minimum on:

- **Ticket updated** — a field filled in, a blocker resolved, or a value corrected (say what changed
  and who supplied it)
- **Build uploaded** — `[build] v<N> uploaded (template <id>, version <id>) — for <requester>`
- **Page created** — `[page] <page-name> created — xcid <xcid>, staging https://staging.mouisys.com/<xcid>`
- **QA verdict** — `[qa] PASS/FAIL — <one-line summary>` (cc-qa posts its full report too)
- **Fix + re-upload** — `[fix] v<N> — <what was wrong, what changed>`
- **Handoff** — `[ready] staging QA'd; production publish pending (owner: Sabi)` + panel edit URL

Move `Status` to `In Progress` when the build starts. Never set `Done` — the requester/owner closes
it after the production publish, which is not the assistant's step. Fill the `## Results` section
in the page body (live page URL + panel edit link) at handoff.

`Created by` on comments records whoever's Notion account the MCP acts as — that's why the
`— for <requester>` suffix is required on every comment, not decoration.
