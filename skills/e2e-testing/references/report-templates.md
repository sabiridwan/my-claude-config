# Report Templates

## HTML Report

Generate an `test-results/report.html` for a rich visual report:

```javascript
// report-generator.js — run after tests complete
const fs = require('fs');

function generateHTMLReport(results, meta) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const rate = Math.round((passed / total) * 100);

  const rows = results.map(r => `
    <tr class="${r.status.toLowerCase()}">
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
      <td>${r.duration_ms}ms</td>
      <td>${r.error || '—'}</td>
      <td>${r.screenshot_path ? `<a href="${r.screenshot_path}">view</a>` : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Test Report</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; color: #333; }
    h1 { font-size: 1.5rem; }
    .summary { display: flex; gap: 2rem; margin: 1rem 0 2rem; }
    .stat { background: #f5f5f5; padding: 1rem 2rem; border-radius: 8px; text-align: center; }
    .stat .num { font-size: 2rem; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #eee; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
    .badge.pass { background: #d4edda; color: #155724; }
    .badge.fail { background: #f8d7da; color: #721c24; }
    .badge.skip { background: #fff3cd; color: #856404; }
    tr.fail td { background: #fff5f5; }
  </style>
</head>
<body>
  <h1>Test Report — ${meta.appName}</h1>
  <p>${meta.date} · ${meta.duration}s · ${meta.baseUrl}</p>
  <div class="summary">
    <div class="stat"><div class="num">${total}</div>Total</div>
    <div class="stat"><div class="num" style="color:#155724">${passed}</div>Passed</div>
    <div class="stat"><div class="num" style="color:#721c24">${failed}</div>Failed</div>
    <div class="stat"><div class="num">${rate}%</div>Pass rate</div>
  </div>
  <table>
    <tr><th>ID</th><th>Test</th><th>Status</th><th>Duration</th><th>Error</th><th>Screenshot</th></tr>
    ${rows}
  </table>
</body>
</html>`;
}

const results = JSON.parse(fs.readFileSync('test-results/results.json'));
const html = generateHTMLReport(results, {
  appName: process.env.APP_NAME || 'App',
  date: new Date().toISOString(),
  duration: process.env.DURATION || '?',
  baseUrl: process.env.BASE_URL
});
fs.writeFileSync('test-results/report.html', html);
console.log('Report written to test-results/report.html');
```

## JSON Report (for CI/CD integration)

```json
{
  "meta": {
    "app": "MyApp",
    "date": "2025-01-01T10:00:00Z",
    "base_url": "http://localhost:3000",
    "duration_ms": 47200,
    "total": 24,
    "passed": 20,
    "failed": 3,
    "skipped": 1
  },
  "results": [
    {
      "id": "A-01",
      "suite": "Authentication",
      "name": "Valid login",
      "status": "PASS",
      "duration_ms": 1240,
      "error": null,
      "screenshot_path": null
    },
    {
      "id": "A-02",
      "suite": "Authentication",
      "name": "Wrong password shows error",
      "status": "FAIL",
      "duration_ms": 980,
      "error": "Expected error message visible, got: element not found",
      "screenshot_path": "test-results/screenshots/A-02-wrong-password.png"
    }
  ]
}
```

## Slack Notification

Post a summary to Slack using a webhook:

```javascript
// slack-notify.js
const https = require('https');
const results = require('./test-results/results.json');

const { meta } = results;
const icon = meta.failed > 0 ? ':warning:' : ':white_check_mark:';
const color = meta.failed > 0 ? '#e74c3c' : '#2ecc71';

const payload = {
  attachments: [{
    color,
    title: `${icon} Test Report — ${meta.app}`,
    text: `*${meta.passed}/${meta.total} passed* · ${meta.failed} failed · ${Math.round(meta.duration_ms/1000)}s`,
    fields: results.results
      .filter(r => r.status === 'FAIL')
      .map(r => ({ title: `❌ ${r.id} — ${r.name}`, value: r.error, short: false })),
    footer: meta.base_url,
    ts: Math.floor(Date.now() / 1000)
  }]
};

// POST to SLACK_WEBHOOK_URL env var
const url = new URL(process.env.SLACK_WEBHOOK_URL);
const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, () => console.log('Slack notified'));
req.write(JSON.stringify(payload));
req.end();
```
