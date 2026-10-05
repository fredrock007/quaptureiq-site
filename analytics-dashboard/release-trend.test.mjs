import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('release copy preserves baseline auth, monitoring, session, and aggregate surfaces', () => {
  for (const marker of ['auth-form', 'sign-out', 'ops-status', 'active-devices', 'recent-events', 'modes', 'sources']) {
    assert.match(html, new RegExp('id="' + marker + '"'));
  }
  assert.match(html, /Bearer ' \+ session\.access_token/);
  assert.match(html, /analytics\/report/);
});

test('release copy includes only the five supported trend cards and approved dark/logo UX', () => {
  assert.match(html, /color-scheme: dark/);
  assert.match(html, /assets\/quaptureiq-horizontal-logo\.png/);
  for (const category of ['plan_tier', 'selected_voice', 'input_path', 'entry_route', 'sign_in_method']) {
    assert.match(html, new RegExp('data-comparison-category="' + category + '"'));
  }
  assert.doesNotMatch(html, /data-comparison-category="user_role"/);
  assert.match(html, /groups below three are hidden/);
  assert.match(html, /comparison_trends/);
  assert.match(html, /Last 24 hours/);
  assert.match(html, /Last 48 hours/);
  assert.match(html, /User role is unsupported/);
});

test('trend cards use real report windows and preserve thresholded empty states', () => {
  assert.match(html, /reportUrl\.searchParams\.set\('since', since\.toISOString\(\)\)/);
  assert.match(html, /reportUrl\.searchParams\.set\('until', until\.toISOString\(\)\)/);
  assert.match(html, /minimum-three privacy threshold/);
  assert.match(html, /No data in this window/);
  assert.match(html, /comparisonViews\[category\]/);
});
