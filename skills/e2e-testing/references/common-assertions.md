# Common Assertions Reference

A quick-reference library for Playwright assertions used in E2E tests.

## Visibility & Presence

```javascript
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toBeAttached();        // in DOM but may be hidden
await expect(locator).toHaveCount(3);        // exactly N elements
```

## Text Content

```javascript
await expect(locator).toHaveText('Exact text');
await expect(locator).toContainText('partial');
await expect(locator).toHaveText(/regex/);
await expect(page).toHaveTitle(/Dashboard/);
```

## URL & Navigation

```javascript
await expect(page).toHaveURL('https://example.com/dashboard');
await expect(page).toHaveURL(/dashboard/);
await page.waitForURL('**/dashboard');
```

## Form Elements

```javascript
await expect(locator).toHaveValue('expected value');
await expect(locator).toBeChecked();
await expect(locator).not.toBeChecked();
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
await expect(locator).toBeFocused();
```

## Response / Network

```javascript
// Wait for an API call to complete
const responsePromise = page.waitForResponse('**/api/users');
await page.click('#load-users');
const response = await responsePromise;
expect(response.status()).toBe(200);

// Intercept and mock a response
await page.route('**/api/products', route =>
  route.fulfill({ json: [{ id: 1, name: 'Mock Product' }] })
);
```

## Screenshots

```javascript
// Full page
await page.screenshot({ path: 'test-results/screenshots/full.png', fullPage: true });

// Specific element
await locator.screenshot({ path: 'test-results/screenshots/element.png' });
```

## Error Capture

```javascript
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push(err.message));
// ... run test ...
// errors now contains any console/page errors
```

## Waiting Strategies (prefer these over waitForTimeout)

```javascript
await page.waitForSelector('.loading', { state: 'hidden' });  // wait for spinner to go
await page.waitForLoadState('networkidle');                    // wait for no network activity
await page.waitForFunction(() => document.title !== 'Loading'); // custom JS condition
await locator.waitFor({ state: 'visible', timeout: 10000 });
```

## Auth / Session

```javascript
// Save session after login
await context.storageState({ path: 'auth.json' });

// Reuse session (skips login)
const context = await browser.newContext({ storageState: 'auth.json' });
```
