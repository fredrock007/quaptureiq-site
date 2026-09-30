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
assert.match(html, /Collection is disabled; no product analytics are being recorded/);
assert.match(html, /prefers-reduced-motion: reduce/);
assert.match(html, /counts\s*\|\|\s*\{\}/);
assert.match(html, /Math\.round\(Number\(count\) \* 1000 \/ total\)/);
assert.match(html, /groups smaller than 3 are hidden/);
assert.match(html, /Collection is off; no events are being recorded/);
assert.match(html, /@media \(max-width:760px\).*comparison-grid/);
assert.doesNotMatch(html, /session\.user\.email/);

console.log('dashboard comparison and mobile checks passed');
