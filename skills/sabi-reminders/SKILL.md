---
name: sabi-reminders
description: Use when Sabi wants to add, update, complete, search, or list reminders. Triggers on phrases like "remind me", "add a reminder", "mark reminder done", "update my reminder", "what are my reminders", "check reminders", or any request to manage personal/work reminders.
---

# Sabi Reminders Skill

Manage Sabi's **Reminders** database in Notion (on the "Sabi's Task Reference" page).

**Database URL:** https://app.notion.com/p/a46c4cee9094444aaa212b2e31516525  
**Data Source ID:** `18057134-23c9-401e-a113-a5d6cf176e47`  
**Parent Page:** https://app.notion.com/p/1b3a5b097ae8801ba3a1c595e2f06f31

---

## Database Schema

```sql
CREATE TABLE (
  "Reminder"  TITLE,
  "Date"      DATE,               -- date:Date:start / date:Date:end / date:Date:is_datetime
  "Status"    STATUS,             -- "Not started" | "In progress" | "Done"
  "Priority"  SELECT,             -- "Low" | "Medium" | "High"
  "Category"  SELECT,             -- "Work" | "Personal" | "Finance" | "Health" | "Tech" | "Follow-up"
  "Recurring" SELECT,             -- "None" | "Daily" | "Weekly" | "Monthly"
  "Notes"     RICH_TEXT
)
```

**Date format rules:**
- Use `date:Date:start` for the date/datetime value (ISO-8601, e.g. `2026-06-20` or `2026-06-20T09:00:00`)
- Set `date:Date:is_datetime` to `1` when a specific time is given, `0` for date-only
- Leave `date:Date:end` null unless it's a range

---

## Operations

### ADD a reminder
Use `notion-create-pages` with parent `data_source_id: 18057134-23c9-401e-a113-a5d6cf176e47`.

**Required:** `Reminder` (title)  
**Optional:** `date:Date:start`, `date:Date:is_datetime`, `Status`, `Priority`, `Category`, `Recurring`, `Notes`

**Defaults when not specified:**
- Status → "Not started"
- Priority → "Medium"
- Recurring → "None"
- Category → infer from context (Work if work-related, Personal otherwise)

**Example:**
```json
{
  "parent": { "type": "data_source_id", "data_source_id": "18057134-23c9-401e-a113-a5d6cf176e47" },
  "pages": [{
    "properties": {
      "Reminder": "Follow up with Ahmed on the proxy PR",
      "date:Date:start": "2026-06-20",
      "date:Date:is_datetime": 0,
      "Status": "Not started",
      "Priority": "High",
      "Category": "Work",
      "Recurring": "None"
    }
  }]
}
```

---

### SEARCH / LIST reminders
Use `notion-search` with `query_type: internal`, searching within the database using `data_source_url: collection://18057134-23c9-401e-a113-a5d6cf176e47`.

For listing all pending reminders or "what are my reminders", search with a broad term or use `notion-fetch` on the database URL.

After finding results, present them in a clean list:
```
• [Reminder name] — [Date] · [Priority] · [Category] · [Status]
```

---

### UPDATE a reminder
1. First search for the reminder by name using `notion-search`
2. Get the page URL/ID from the result
3. Use `notion-update-page` with `command: update_properties` and the page ID

**Updatable fields:** Reminder (title), Date, Status, Priority, Category, Recurring, Notes

---

### MARK COMPLETE
1. Search for the reminder
2. Use `notion-update-page` with `command: update_properties`:
   ```json
   { "Status": "Done" }
   ```

---

### DELETE / ARCHIVE
Notion doesn't support delete via API. Instead, set `Status: "Done"` and confirm with Sabi.

---

## Behavior Rules

1. **Always confirm** before creating — repeat back what you're about to add and ask "Should I save this?"
2. **Infer smartly** — if Sabi says "remind me Friday", calculate the date from today (2026-06-17, Tuesday → Friday = 2026-06-20).
3. **Relative dates** — "tomorrow" = 2026-06-18, "next Monday" = 2026-06-22, "end of week" = 2026-06-21 (Sunday).
4. **After any write**, confirm success and show the Notion page URL.
5. **For lists**, show only "Not started" and "In progress" by default unless Sabi asks for completed ones.
6. **Category inference** — if Sabi mentions server/code/deploy/PR/bug → "Work" → "Tech"; money/payment/invoice → "Finance"; health/gym/doctor → "Health"; else → "Personal".
