# Claude Test Configuration

## Credentials
All credentials are stored in the `.env` file in this directory.
**Never ask the user for credentials interactively.**
Required variables: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD

Optional variables:
- USER_EMAIL / USER_PASSWORD — for testing regular user flows
- SLACK_WEBHOOK_URL — for Slack notifications after test runs
- APP_NAME — display name used in reports

## Session Management
- If `auth.json` exists and is less than 24 hours old, reuse it (skip login)
- After a fresh login, always save the session: `context.storageState({ path: 'auth.json' })`
- Delete `auth.json` and re-authenticate if login fails with a saved session

## Browser Settings
- Always run **headless** unless the user explicitly says otherwise
- Viewport: 1280x800 by default
- Locale: en-US

## Test Execution
- Follow `TEST_PLAN.md` in this directory
- Do not expand scope or add new tests without being asked
- Timeout per individual test: 30 seconds
- On failure: take screenshot, log error, continue to next test
- Never stop the entire run because one test failed

## Output
- Reports: `test-results/report.md` (always) and `test-results/report.html` (when requested)
- Screenshots: `test-results/screenshots/[TEST-ID]-[description].png`
- Raw results JSON: `test-results/results.json`

## Notifications
If SLACK_WEBHOOK_URL is set, post a summary to Slack after every run.

## Environment
- **Never test against production** unless BASE_URL points to production AND the user
  has explicitly confirmed it is OK to test there.
- Default assumption: local or staging environment.
