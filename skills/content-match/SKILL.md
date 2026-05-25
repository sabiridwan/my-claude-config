---
name: content-match
description: Use when the user wants to compare two pages, files, or components to verify content matches 100% including text, paragraph breaks, spacing, indentation, structure, and order. Triggers on "compare page A and B", "make sure content matches", "content-match", "check if these are identical", "sync content between files", "paragraph seems off", or any request to verify or enforce exact parity between two sources.
---

# Content Match

Compares two pages, files, or components and ensures they are 100% identical in content, paragraph structure, spacing, indentation, and order. Reports every difference — no matter how small — and fixes on request.

**IMPORTANT: You MUST follow every step below in order. Do not skip, merge, or shortcut any step.**

## When to Use

- Verifying a translated/duplicated page matches the original
- Ensuring a component was copied correctly across modules
- Confirming a refactored file still has identical output/structure
- Syncing content between two versions of a page
- Checking paragraph/line breaks match between two text blocks

## Workflow — Follow Every Step

```
Step 1: Read both sources IN FULL
Step 2: Split into paragraph/block units
Step 3: Diff each unit
Step 4: Report ALL differences with exact quotes
Step 5: Fix only if user asks
Step 6: Re-verify after fix
```

### Step 1 — Read both sources completely

Read A and B in full before doing anything. Never compare from memory or partial content.

### Step 2 — Split into paragraph/block units

**This step is mandatory — do not skip it.**

Break each source into its structural units:
- Each paragraph (separated by a blank line) = one unit
- Each heading = one unit
- Each list item = one unit
- Each code block = one unit

Count the units in A and B. If the count differs — that is already a difference. Report it immediately.

Example:
```
A has 3 paragraphs. B has 2 paragraphs. → MISMATCH: B is missing 1 paragraph break.
```

### Step 3 — Diff each unit

For files on disk:
```bash
diff -u <file-a> <file-b>                        # character-level with whitespace
diff -y --width=200 <file-a> <file-b>            # side-by-side
diff <file-a> <file-b> && echo "✓ IDENTICAL"
```

For pasted/inline text — compare unit by unit checking:
- Every word and character
- Leading/trailing spaces
- Blank lines (count AND position)
- Paragraph breaks (a missing blank line = merged paragraphs = a difference)
- Line endings, indentation depth, tabs vs spaces

### Step 4 — Report ALL differences

**Never say "mostly the same" or skip minor differences. Every difference must be listed.**

Use this format:

```
PARAGRAPH BREAK — MISSING in B after:
  "...unconditionally bound by these Terms and Conditions of Use."
  A splits into 2 paragraphs here. B continues as 1 paragraph.

TEXT DIFF — Paragraph 2, sentence 3:
  A: "you should not use the service,"
  B: "you should not use the service."   (comma → period)

SPACING — Line 4:
  A: "  return value  "  (2 trailing spaces)
  B: "  return value"    (no trailing spaces)
```

If zero differences: `✓ IDENTICAL — content matches 100%`

### Step 5 — Fix (only if asked)

Default: **report only.** Do not change anything unless the user explicitly says "fix it" or "make them match".

When fixing:
- Confirm which is the **source of truth** (A or B)
- Apply only the minimal changes needed
- Proceed to Step 6

### Step 6 — Re-verify after fix

After every fix, re-run the full comparison from Step 2. Do not assume the fix worked. Prove it:

```
✓ Re-verified — content matches 100%
```

## Rules — No Exceptions

- **Paragraph breaks count.** Two paragraphs merged into one is a difference.
- **Blank lines count.** An extra or missing blank line is a difference.
- **Trailing spaces count.** A trailing space is a difference.
- **"Close enough" is not a pass.** 100% match only.
- **Always report first, fix second.**
- **Always re-verify after fixing.**

## Quick Reference

```bash
# Exact file match
diff -u pageA.tsx pageB.tsx

# Ignore line endings only (useful cross-OS)
diff -u --strip-trailing-cr pageA.tsx pageB.tsx

# Count differences
diff pageA.tsx pageB.tsx | grep "^[<>]" | wc -l

# Side-by-side view
diff -y --width=200 pageA.tsx pageB.tsx
```
