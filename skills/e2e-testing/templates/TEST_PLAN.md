# Test Plan — [App Name]
Generated: [date]
Base URL: [url]
Tester: Claude (automated)

## Scope
This plan covers [describe what is being tested — e.g. "the core user flows of the
hotel booking app including search, booking, and account management"].

## Out of Scope
- Payment gateway (mocked in test environment)
- Email delivery (verified via UI confirmation only)
- [Add anything else excluded]

---

## Test Suites

### Suite 1: Authentication  
Priority: HIGH  
Estimated time: 3 min

| ID   | Test Case                        | Steps                                              | Expected Result                  |
|------|----------------------------------|----------------------------------------------------|----------------------------------|
| A-01 | Valid login                      | Enter correct credentials, submit                  | Redirect to dashboard            |
| A-02 | Wrong password                   | Enter wrong password, submit                       | Error message displayed          |
| A-03 | Empty email                      | Leave email blank, submit                          | Validation error on email field  |
| A-04 | Empty password                   | Leave password blank, submit                       | Validation error on password     |
| A-05 | Logout                           | Click logout                                       | Redirect to login page           |
| A-06 | Access protected route logged out| Navigate to /dashboard without login               | Redirect to login                |

---

### Suite 2: [Feature Name]
Priority: HIGH / MEDIUM / LOW
Estimated time: ? min

| ID   | Test Case | Steps | Expected Result |
|------|-----------|-------|-----------------|
| B-01 | ...       | ...   | ...             |

---

### Suite 3: [Feature Name]
Priority: MEDIUM
Estimated time: ? min

| ID   | Test Case | Steps | Expected Result |
|------|-----------|-------|-----------------|
| C-01 | ...       | ...   | ...             |

---

## Credentials
Read from `.env` file. Required variables:
- `BASE_URL`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `USER_EMAIL` / `USER_PASSWORD` (if testing non-admin flows)

## Notes
[Any special instructions, known issues, or environment notes]
