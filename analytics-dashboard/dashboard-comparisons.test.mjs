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
assert.match(html, /Collection is off; no events are being recorded/);
assert.match(html, /prefers-reduced-motion: reduce/);
assert.match(html, /apiBaseUrl.*https:\/\/84\.12\.79\.38/);
assert.doesNotMatch(html, /id="api-base"/);
assert.match(html, /AUTO_REFRESH_INTERVAL_MS = 60000/);
assert.match(html, /id="active-devices"/);
assert.match(html, /Active app sessions/);
assert.match(html, /not a unique-user or unique-device count/);
assert.match(html, /report\.active_app_sessions/);
assert.match(html, /Number\.isInteger\(activeSessions\)/);
assert.match(html, /Sign out of dashboard/);
assert.match(html, /does not sign you out of the QuaptureIQ mobile app/);
assert.match(html, /Image uploaded from device/);
assert.match(html, /Q Lens from Home/);

assert.match(html, /counts\s*\|\|\s*\{\}/);
assert.match(html, /Math\.round\(Number\(count\) \* 1000 \/ total\)/);
assert.match(html, /groups smaller than 3 are hidden/);
assert.match(html, /Collection is off; no events are being recorded/);
assert.match(html, /@media \(max-width:760px\).*comparison-grid/);
assert.doesNotMatch(html, /session\.user\.email/);

console.log('dashboard comparison and mobile checks passed');
