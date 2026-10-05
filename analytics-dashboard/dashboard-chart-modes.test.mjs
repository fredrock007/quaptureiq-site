import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('all supported comparison cards expose the four requested views', () => {
  assert.equal((html.match(/data-comparison-view="table"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="line"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="pie"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="bar"/g) || []).length, 5);
  assert.doesNotMatch(html, /data-comparison-category="user_role"/);
});

test('chart modes preserve real windows and privacy-safe empty states', () => {
  assert.match(html, /reportUrl\.searchParams\.set\('since', since\.toISOString\(\)\)/);
  assert.match(html, /reportUrl\.searchParams\.set\('until', until\.toISOString\(\)\)/);
  assert.match(html, /groups smaller than 3 are hidden/);
  assert.match(html, /No data in this window/);
  assert.match(html, /comparisonViews\[spec\.category\] === 'line'/);
  assert.match(html, /comparisonViews\[spec\.category\] === 'pie'/);
  assert.match(html, /comparisonViews\[spec\.category\] === 'bar'/);
  assert.match(html, /UTC six-hour buckets/);
});

console.log('dashboard chart mode checks passed');
