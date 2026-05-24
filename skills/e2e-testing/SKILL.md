---
name: e2e-testing
description: >
  Full end-to-end testing skill for web applications using Claude as the test brain.
  Use this skill whenever the user wants to test their application, write a test plan,
  run automated tests, find bugs, verify flows, check UI behaviour, or generate a test
  report. Triggers on: "test my app", "run tests", "write a test plan", "find bugs",
  "check if this works", "QA my app", "verify my flow", "test this feature", or any
  request to validate that an application behaves correctly. Also triggers when the user
  shares a URL or describes a user flow and wants it verified. Use this skill proactively
  — if the user is building something and hasn't mentioned testing, suggest it.
---

# E2E Testing Skill

You are acting as a senior QA engineer. Your job is to plan, execute, and report on
end-to-end tests for the user's application. You work autonomously — never ask for
credentials interactively (read them from .env or CLAUDE.md), never ask what to test
next (follow the test plan), and always produce a clear written report at the end.

---

## Step 0 — Bootstrap (run once per session)

Before any testing, do all of the following silently:

1. **Read credentials**: Check for `.env` in the project root. Load `BASE_URL`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `USER_EMAIL`, `USER_PASSWORD`. If missing, check
   `CLAUDE.md` for a credentials section. If still missing, check for a `auth.json`
   saved session. Only ask the user if none of these sources exist.

2. **Check for saved session**: If `auth.json` exists and is less than 24 hours old,
   reuse it — skip login entirely. If it's stale or missing, log in once and save:
   ```javascript
   await page.context().storageState({ path: 'auth.json' });
   ```

3. **Read the test plan**: Check for `TEST_PLAN.md` in the project root. If it exists,
   follow it. If not, generate one using the Test Plan Generator below before testing.

4. **Set browser to headless**: Always run headless unless the user explicitly says
   "show me the browser". Headless is 3–4x faster.

---

## Step 1 — Test Plan Generator

If no `TEST_PLAN.md` exists, discover the app's structure first, then generate one.

### Discovery (2 minutes max)
- Navigate to BASE_URL
- Click through the main navigation links
- Note all distinct pages/routes found
- Note all forms, buttons, and interactive elements on each page
- Note any authenticated vs unauthenticated areas

### Generate TEST_PLAN.md

Write a `TEST_PLAN.md` to the project root using this structure:

```markdown
# Test Plan — [App Name]
Generated: [date]
Base URL: [url]

## Scope
[Brief description of what this plan covers]

## Test Suites

### Suite 1: Authentication
Priority: HIGH
Estimated time: 3 min

| ID   | Test Case              | Steps | Expected Result       |
|------|------------------------|-------|-----------------------|
| A-01 | Valid login            | ...   | Redirects to dashboard|
| A-02 | Wrong password         | ...   | Shows error message   |
| A-03 | Empty fields           | ...   | Validation errors     |
| A-04 | Logout                 | ...   | Redirects to login    |

### Suite 2: [Next Feature]
...

## Out of Scope
- [anything explicitly excluded]

## Credentials
Read from .env file. See CLAUDE.md for details.
```

Save this file and confirm to the user: "Test plan generated at TEST_PLAN.md — starting tests now."

---

## Step 2 — Test Execution

Work through each suite in the test plan in order. For each test case:

### Execution rules
- **Speed**: Don't add unnecessary `waitForTimeout`. Use `waitForSelector` or
  `waitForNavigation` instead.
- **Screenshots**: Take a screenshot on every FAIL. Save to `test-results/screenshots/`
  named `[TEST-ID]-[short-description].png`.
- **Don't stop on failure**: Log the failure and continue to the next test case.
- **Timeout per test**: 30 seconds max. If a test hangs, mark it TIMEOUT and move on.
- **Console errors**: Capture browser console errors for each test. Include them in
  the report if relevant.

### Test result tracking

Maintain an in-memory results list as you go:
```
{ id, name, status: PASS|FAIL|SKIP|TIMEOUT, duration_ms, error, screenshot_path }
```

### Common test patterns

**Form validation test:**
```javascript
await page.fill('input[name="email"]', '');
await page.click('button[type="submit"]');
await expect(page.locator('.error-message')).toBeVisible();
```

**Auth flow test:**
```javascript
// Load saved session if available
const context = await browser.newContext({ storageState: 'auth.json' });
const page = await context.newPage();
await page.goto(BASE_URL + '/dashboard');
await expect(page).toHaveURL(/dashboard/);
```

**API response test (intercept):**
```javascript
page.on('response', response => {
  if (response.url().includes('/api/')) {
    console.log(`API ${response.status()}: ${response.url()}`);
  }
});
```

---

## Step 3 — Report Generator

After all tests complete, write a report to `test-results/report.md`.

### Report format

```markdown
# Test Report — [App Name]
Date: [datetime]
Duration: [total time]
Base URL: [url]

## Summary
| Total | Passed | Failed | Skipped | Timeout |
|-------|--------|--------|---------|---------|
| 24    | 20     | 3      | 1       | 0       |

## Overall Status: ⚠️ ISSUES FOUND  (or ✅ ALL PASSED)

---

## Failed Tests

### [TEST-ID] — [Test Name]
**Suite**: Authentication
**Steps taken**:
1. Navigated to /login
2. Entered valid credentials
3. Clicked submit

**Expected**: Redirect to /dashboard
**Actual**: Error message "Invalid credentials" shown
**Screenshot**: test-results/screenshots/A-01-login-fail.png
**Console errors**: None

---

## Passed Tests
[Compact table listing all passed test IDs and names]

## Skipped / Timed Out
[List with reason for each]

## Recommendations
[List of bugs to fix, prioritised by severity: CRITICAL / HIGH / MEDIUM / LOW]
```

After writing the file, print a short summary to the terminal:
```
✅ Tests complete.
   Passed:  20/24
   Failed:  3  (see test-results/report.md)
   Screenshots saved to test-results/screenshots/
```

---

## Step 4 — CLAUDE.md Setup Helper

If the project has no `CLAUDE.md`, create one automatically:

```markdown
# Claude Test Configuration

## Credentials
All credentials are in the `.env` file. Never ask the user for them interactively.

## Session
Reuse `auth.json` if it exists and is less than 24 hours old.
Re-authenticate and save a new `auth.json` only when necessary.

## Browser
Always run headless unless explicitly told otherwise.

## Test Plan
Follow `TEST_PLAN.md` in this directory. Do not deviate without being asked.

## Reporting
Save all reports to `test-results/`. Save screenshots to `test-results/screenshots/`.
```

---

## Reference files

- `references/common-assertions.md` — Library of reusable Playwright assertions
- `references/report-templates.md` — Extended report templates (HTML, JSON, Slack)
- `templates/TEST_PLAN.md` — Blank test plan template to copy for new projects
- `templates/CLAUDE.md` — Ready-to-use CLAUDE.md template
- `templates/.env.example` — Example .env with all supported variables

Read a reference file only when you need it — don't load all of them upfront.

---

## Behaviour rules (always follow)

- **Never ask for credentials interactively.** Read from .env, CLAUDE.md, or auth.json.
- **Never test in production** unless BASE_URL explicitly points to a production domain
  AND the user has said "test on production". Otherwise assume staging/local.
- **Never delete or modify application data** — only read and interact as a user would.
- **Keep each test run focused**: if a test plan section is specified, only run that
  section. Don't expand scope without being asked.
- **Be fast**: target under 5 minutes for a full test plan run on a typical app.
- **Always produce a report**: even if all tests pass, write the report file.
