---
name: cc-ticket-analyzer
description: >-
  Analyze the Sam Media CC Tasks board in Notion and produce a read-only briefing of what is on
  Sabi's plate: which tickets are assigned to him, which comments @mention him and still need a
  reply, what each ticket is actually asking for, and — diffed against a fixed per-type checklist —
  exactly which pieces of information are MISSING before the work can start (slug, gateway, bankId,
  merchant IDs, MCC, domain, branding, creative...). Before flagging a field as missing it checks
  the linked Notion pages, the local repos under ~/SamMedia, and the Ouisys panel. Use for "analyze
  my tickets", "cc ticket analyzer", "what's on my plate", "what do I need to reply to", "which
  tickets can I start", "what info is missing on my tickets", "go through my Notion CC tickets", or
  when Sabi points at the CC Tasks board and asks what to do next. This skill NEVER writes to
  Notion and never mutates the panel — drafted replies stay in the report for him to send himself.
---

# cc-ticket-analyzer — read-only briefing on the CC Tasks board

Answer one question: *what is on my plate, what do I need to reply to, and which tickets can I
actually start today?*

Pull the tickets assigned to Sabi plus any ticket where a comment mentions him, classify each one,
diff it against a fixed per-type completeness checklist, try to resolve the remaining gaps from the
linked Notion pages / local repos / Ouisys panel, and write a ranked briefing.

This skill is the *front* of the credit-card pipeline: it tells you which tickets are ready for
`cc-launch` / `cc-dynamic-lp` / `dmb-replicate-site` and which are blocked on information. It never
starts that work itself.

## Read-only guarantee (non-negotiable)

This is the property that makes the skill safe to run unattended. It must survive every future edit
to this file.

- **Never** call `notion-create-comment`, `notion-update-page`, `notion-create-pages`,
  `notion-update-data-source`, `notion-move-pages`, or any other mutating Notion tool.
- **Never** change a ticket's status, assignee, or any other property.
- In the Ouisys panel: **search and View Details only**. Never Save, Publish, Hide, Delete, Clone,
  or submit an Edit form.
- Drafted replies are report text. They are **never posted**. If Sabi wants one sent, he sends it.
- Do not invoke `cc-launch`, `cc-dynamic-lp`, `cc-payment-integration`, or `dmb-*`. Naming them as
  the recommended next step in the report is the correct output; running them is out of scope.

## Arguments

| Argument | Effect |
| --- | --- |
| *(none)* | Full run: both tiers, repo + panel resolution |
| `--fast` | Notion only. Skips the repo scan and the panel lookup. No browser. |
| `--since <window>` | Tier B sweep window. Default `60d`. `all` sweeps every open ticket. |
| `<board-url>` | Analyze a different board. Re-derive its data source via `notion-fetch`. |

## Tools

Notion tools are usually deferred. Load them in **one** ToolSearch call before starting:

```
ToolSearch select:notion-fetch,notion-query-data-sources,notion-get-comments,notion-get-users
```

If the `select:` form misses (the MCP server id is a hash that varies between sessions), fall back
to a keyword query — `ToolSearch "notion fetch query data sources comments"` — and use whatever
prefixed names come back. All four are read-only.

`query_data_sources` is `available_with_limit` on this workspace's plan. Every query in this skill
stays within a **single** data source, so the multi-source Enterprise requirement does not apply. If
a run hits the limit, fall back to `query_database_view` against the "Latest Tasks" view, which is
unmetered.

Browser access for the panel step goes through **`cc-ouisys-panel`** — delegate to that skill rather
than driving the panel directly, and inherit its tooling (`claude-in-chrome`) and its hard-won
gotchas. Do not substitute `chrome-devtools` here; `cc-ouisys-panel` is written and proven against
`claude-in-chrome`, and it is not always connected.

## References

Read the one you need before acting on it:

| File | Contents |
| --- | --- |
| `references/notion-queries.md` | Workspace ids, tier A / tier B SQL, the enrich call |
| `references/classification.md` | Type signals and how to resolve conflicts |
| `references/checklists.md` | The per-type field lists, and why pricing is excluded |

## The pipeline

### 1. Identity

`notion-fetch` with id `self` → workspace and user id. Confirm the user id against `self` rather
than trusting the hardcoded fallback in `references/notion-queries.md`.

### 2. Tier A — assigned to me

Run the tier A query from `references/notion-queries.md`: assignee contains the user, status not in
`Done` / `Archived` / `Not Applicable Anymore`.

### 3. Tier B — mention sweep

A ticket assigned to someone else can still carry a request aimed at Sabi. Sweeping every open
ticket with `get_comments` on each run is too slow (the board carries ~156 open), so the sweep is
bounded by edit recency: open, not assigned to Sabi, edited within the window (default `60d`).

Then `get_comments` with `include_all_blocks: true` on each result, keeping tickets whose comments
contain `user://<user-id>`.

**Known limitation — do not paper over it.** Whether posting a comment bumps a page's
`Last edited time` is unverified. If it does not, a comment on a long-dormant ticket falls outside
the window and is missed. All three mitigations are required:

1. The window defaults to `60d`, well beyond the ~30d activity band.
2. `--since all` performs the full sweep on demand.
3. The report opens with the real coverage line — *"swept N tickets, window X, M mentions found"* —
   so the bound is visible instead of assumed.

If you ever get the chance to settle this empirically (a comment lands on a dormant ticket, then
re-query its `Last edited time`), record the answer and delete whichever mitigation it makes moot.

### 4. Enrich

For every surviving ticket: `notion-fetch` with `include_discussions: true`, then follow
`mention-page` links **one level deep** — linked MID pages, the Project page, a linked Portfolio
ticket.

One level is deliberate. Without it, a ticket like *Portfolio Page for PXP Bank* has its five MIDs
false-flagged as missing, because they live on linked sub-pages rather than in the ticket body.
Beyond one level the crawl fans out across the workspace for no gain.

**The MID links are the payload, not a footnote.** A linked MID is a row in the MIDs database
carrying `Descriptor` (the domain), `MCC Code`, `Gateway`, `Bank`, `Products`, and `Status` —
i.e. most of what the checklists ask for. See the MID registry section of
`references/notion-queries.md`.

Those last fields are **relations**, so they come back as URLs rather than names. Resolve each with
a second targeted `notion-fetch`; the value is the page **title** (`MCC Code` →
`7399 - Business Services (Not Elsewhere Classified)`, `Gateway` → `ACI`). This is the one place a
second hop is warranted, and only for relations a checklist actually reads.

**Cache resolved relation URLs for the whole run.** One Gateway page backs all five PXP MIDs;
without the cache this step dominates the runtime of a multi-MID ticket.

A MID's `Status` is a **gating fact**. `In Approval` or `Proposed` means the ticket is blocked on
approval no matter how complete its fields are — rank it *blocked on others*, not actionable.

**Ticket body shape.** Tickets follow a template:

```
## Description and Why
<prose, plus one or more tables carrying the real config>
---
## Expected Results
…
## Results
…
```

`Expected Results` and `Results` are usually literal `…` placeholders. **Treat an unfilled section
as absent, not as content.** The config that matters lives in the tables and the `mention-page`
links, not the prose.

### 5. Classify

Assign exactly one type per ticket — `cc-landing-page`, `portfolio-page`, `payment-integration`, or
`other` — using `references/classification.md`.

### 6. Checklist diff

Diff the ticket against the fixed checklist for its type (`references/checklists.md`). Every field
resolves to one of:

- **Present** — with the value *and where it came from* (ticket table, linked page, repo, panel).
- **Missing** — nothing found anywhere.
- **Unclear** — present but contradictory, ambiguous, or malformed.

Checklists are fixed, so the same ticket produces the same gaps on every run. That determinism is
the point; do not improvise extra fields into the diff.

### 7. Resolve before flagging

Runs **only** for build-type tickets that still have gaps after step 6. Skipped entirely under
`--fast`.

**Repo scan.** Search these roots for a project matching the product or slug:

```
~/SamMedia/credit-card/*
~/SamMedia/dmb-portfolios
~/SamMedia/agency-portfolios
~/SamMedia/partnership-portfolios
~/SamMedia/products
```

Read `.env` (the `page` key), `product.json`, and pageConfigs. This turns *"missing bankId"* into
*"already scaffolded at `~/SamMedia/credit-card/<name>`, only bankId missing"* — a completely
different instruction to the reader.

**Panel lookup.** Delegate to `cc-ouisys-panel`. Broad-search Templates, Unpublished, and Published
for the slug or product name; read via `Actions` → `View Details`.

Read-only, and two specific traps from that skill:

- **Never type into the MCC combobox.** Its search filter throws and discards every filled field.
- The `Actions` menu renders in a portal — `find` the item and click it by `ref`; a screenshot may
  show nothing.

Both sub-steps cost minutes per ticket. That is why they are gated behind "gaps still remain" and
why `--fast` exists.

### 8. Comment triage

Independent of the checklist, and the part most likely to be the actual reason Sabi ran this.

A fixed checklist cannot represent an instruction like *"MCC will pe prizeflix"* or *"don't use
google pay in the naming convention"* — but those are exactly the comments that need a reply.

For every comment mentioning Sabi with **no later comment from him in the same discussion**:

- Quote it **verbatim**, with author and timestamp.
- Draft a suggested reply.
- Note whether the comment changes any checklist answer (it usually does — a comment saying "we
  don't have Google Pay" resolves the payment-methods field).

The draft is report text. It is never posted.

### 9. Report

Write a dated markdown file to the session scratchpad, and print a ranked summary to the terminal.

Rank in this order:

1. **Actionable now** — checklist complete, nothing blocking. Name the skill that should run next.
2. **Blocked on info** — with the exact list of what to ask for, and who to ask (the ticket's
   `Created by`, usually).
3. **Blocked on others** — a dependency, or a `Blocked By` relation.
4. **Reply only** — no build work, just an unanswered comment.

Per-ticket entry:

- Title, link, type, status / priority
- One-line summary of the ask
- Present / Missing / Unclear table
- Resolution notes from the repo scan and the panel lookup
- Quoted comments awaiting reply, with drafted responses
- Recommended next step

The report **opens with the coverage line** from step 3.

### Always link. Every identifier is a link.

A report the reader has to search their workspace to act on has failed at the last step. Whenever
you name one of these, render it as a markdown link, not bare text:

| Thing | Link to |
| --- | --- |
| Ticket (`CC-379`) | its Notion page URL |
| Panel page id (`1056`) | `https://panel.ouisys.com/dynamic-pages/update-credit-card/<id>` |
| Page name / xcid (`xd6b0`) | the live LP `https://<domain>/lp/<xcid>` |
| An unpublished xcid | staging `https://staging.mouisys.com/<xcid>?d_country=nl` |
| Transaction id (`2070215`) | `https://lc2.sam-media.com/nova/resources/lc2-transactions/<id>` |
| Subscription / rockman id | `https://lc2.sam-media.com/nova/resources/lc2-subscriptions/<id>` |
| Service id | `https://lc2.sam-media.com/nova/resources/lc2-services/<id>` |
| A quoted comment | its comment permalink from `get_comments` (`?d=<discussion>`) |
| A local file or repo path | a relative markdown link, with `:line` when you mean a line |

Prefer the link the ticket itself supplies — the tables carry `Edit Page` and `LP Link` columns —
over one you construct. Construct only when the ticket has none, and say so if you constructed it.

A live page and its panel record are different destinations; when both exist, give both. For an
unpublished page the `/lp/<xcid>` URL 404s until publish, so lead with the staging link and mark the
live one as pending.

## Failure modes to avoid

- **Reporting pricing as missing.** Prices come from panel config at runtime and are never
  hardcoded. See `references/checklists.md`.
- **False-flagging linked content.** If a field is on a `mention-page` link you did not follow, you
  will report Missing on data that exists. Do step 4 properly.
- **Treating `…` as content.** The empty `Expected Results` / `Results` sections are placeholders.
- **Silently narrowing the sweep.** If you skipped or shortened tier B, the coverage line must say
  so. A briefing that looks complete but isn't is worse than one that admits its bound.
- **Drifting into action.** Recommending `cc-launch` is the output. Running it is not.
