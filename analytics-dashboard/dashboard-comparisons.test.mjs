import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

for (const id of [
  'comparison-plan', 'comparison-voice', 'comparison-input',
  'comparison-route', 'comparison-signin',
  'comparison-role',
]) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.doesNotMatch(html, /id="comparison-gender"/);
assert.match(html, /The app does not currently record an explicit user-selected role/);
assert.match(html, /id="collection-status"/);
assert.match(html, /data-state="unknown"/);
assert.match(html, /Analytics collection enabled/);
assert.match(html, /Collection status unavailable/);
assert.match(html, /typeof report\.collection_enabled === 'boolean'/);
assert.match(html, /Analytics collection disabled/);
assert.match(html, /prefers-reduced-motion: reduce/);
assert.match(html, /<script src="\.\/config\.production\.js"><\/script>/);
assert.doesNotMatch(html, /<script src="\.\/config\.js"><\/script>/);
assert.match(html, /Dashboard API configuration is missing or not permitted/);
assert.doesNotMatch(html, /84\.12\.79\.38/);
assert.ok(!/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(html), 'published page must not contain a local API URL');
assert.ok(!/https?:\/\/[^\s'"`]*(?:candidate|qa)(?:[^\s'"`]*)/i.test(html), 'published page must not contain a QA or candidate API URL');
assert.doesNotMatch(html, /id="api-base"/);
assert.match(html, /AUTO_REFRESH_INTERVAL_MS = 60000/);
assert.match(html, /id="active-devices"/);
assert.match(html, /Active app sessions/);
assert.match(html, /successful foreground marker or heartbeat in the last 2 minutes/);
assert.match(html, /not a unique-user or unique-device count/);
assert.match(html, /If you are on Home but this stays at 0/);
assert.match(html, /id="toast" class="toast" role="status" aria-live="polite"/);
assert.match(html, /report\.active_app_sessions/);
assert.match(html, /Number\.isInteger\(activeSessions\)/);
assert.match(html, /Sign out of dashboard/);
assert.match(html, /does not sign you out of the QuaptureIQ mobile app/);
assert.match(html, /Image uploaded from device/);
assert.match(html, /Q Lens from Home/);
assert.match(html, /id="telemetry-coverage"/);
assert.match(html, /What this dashboard currently monitors/);
assert.match(html, /Successful-request sampling is not enabled/);
assert.match(html, /90-day retention/);
assert.match(html, /48-hour raw retention and seven-day hourly rollups are not configured/);
assert.match(html, /Supabase metrics/);
assert.match(html, /Host resources and disk I\/O/);
assert.match(html, /Connection counts and metrics-request latency appear when supplied/);
assert.match(html, /Disk read\/write rates appear only when the API provides usable storage_io samples/);
assert.match(html, /id="answer-display-timings"/);
assert.match(html, /Response time \(ms\)/);
assert.match(html, />Time<\/text>/);
assert.match(html, /id="ops-status-title"/);
assert.match(html, /monitoring_incomplete: 'Monitoring incomplete'/);
assert.match(html, /\.coverage-grid/);
assert.match(html, /@media \(max-width:760px\).*coverage-grid/);

assert.match(html, /counts\s*\|\|\s*\{\}/);
assert.match(html, /Math\.round\(Number\(count\) \* 1000 \/ total\)/);
assert.match(html, /groups smaller than 3 are hidden/);
assert.match(html, /typeof report\.collection_enabled === 'boolean'/);
assert.match(html, /@media \(max-width:760px\).*comparison-grid/);
assert.match(html, /color-scheme: dark/);
assert.match(html, /quaptureiq-horizontal-logo\.png/);
assert.match(html, /comparison-charts\.js/);
assert.match(html, /id="comparison-range"/);
assert.equal((html.match(/data-comparison-view="line"/g) || []).length, 5);
assert.equal((html.match(/data-comparison-view="pie"/g) || []).length, 5);
assert.equal((html.match(/data-comparison-view="bar"/g) || []).length, 5);
for (const category of ['plan_tier', 'selected_voice', 'input_path', 'entry_route', 'sign_in_method']) {
  assert.match(html, new RegExp('data-comparison-category="' + category + '"'));
}
assert.doesNotMatch(html, /data-comparison-category="user_role"/);
assert.match(html, /comparison_trends/);
assert.match(html, /six-hour choice bucket meets the minimum-three privacy threshold/);
assert.match(html, /function renderComparisonPie/);
assert.match(html, /function renderComparisonBar/);
assert.match(html, /comparisonViews\[spec\.category\] === 'pie'/);
assert.match(html, /comparisonViews\[spec\.category\] === 'bar'/);
assert.doesNotMatch(html, /session\.user\.email/);
assert.match(html, /points\.length > 1/);
assert.match(html, /<circle class="comparison-point" data-count=/);
assert.match(html, /comparison-chart-wrap \.comparison-point/);

console.log('dashboard comparison and mobile checks passed');
