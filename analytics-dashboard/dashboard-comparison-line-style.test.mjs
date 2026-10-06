import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const helperSource = await readFile(new URL('./comparison-charts.js', import.meta.url), 'utf8');
const curveStart = html.indexOf('  function comparisonCurvePath(points) {');
const renderStart = html.indexOf('  function renderComparisonLine(target, trend, choices, label, reportWindow) {', curveStart);
const renderEnd = html.indexOf('\n  function renderComparisonCards(report)', renderStart);
assert.notEqual(curveStart, -1);
assert.notEqual(renderStart, -1);
assert.notEqual(renderEnd, -1);
const renderer = html.slice(curveStart, renderEnd);

function renderLine() {
  const window = {};
  const target = { innerHTML: '' };
  const context = {
    window,
    document: {},
    safe: (value) => String(value),
    number: (value) => Number(value).toLocaleString('en-US'),
    comparisonLineColors: ['#f59e0b', '#ef4444', '#3b82f6'],
  };
  vm.createContext(context);
  vm.runInContext(helperSource, context);
  vm.runInContext(`${renderer}\nrenderComparisonLine(target, trend, choices, 'Plan tier', reportWindow);`, Object.assign(context, {
    target,
    trend: { series: {
      free: [6, 18, 14, 18, 12].map((count, index) => ({ bucket_start: `2026-10-05T${String(index * 6).padStart(2, '0')}:00:00Z`, count })),
      student: [4, 12, 9, 12, 6].map((count, index) => ({ bucket_start: `2026-10-05T${String(index * 6).padStart(2, '0')}:00:00Z`, count })),
      professional: [3, 4, 3, 8, 3].map((count, index) => ({ bucket_start: `2026-10-05T${String(index * 6).padStart(2, '0')}:00:00Z`, count })),
    } },
    choices: ['free', 'student', 'professional'],
    reportWindow: { since: '2026-10-05T00:00:00Z', until: '2026-10-06T00:00:00Z' },
  }));
  return target.innerHTML;
}

test('line chart uses the approved orange/red/blue palette and smooth bounded curves', () => {
  const output = renderLine();
  const paths = [...output.matchAll(/<path class="comparison-series" d="([^"]+)" stroke="([^"]+)"\/>/g)];
  assert.equal(paths.length, 3);
  assert.deepEqual(paths.map(([, , color]) => color), ['#f59e0b', '#ef4444', '#3b82f6']);
  for (const [, path] of paths) {
    assert.match(path, /^M [\d.]+ [\d.]+ C /, 'line segments use cubic curves');
    const initialY = Number(path.match(/^M [\d.]+ ([\d.]+)/)[1]);
    const segments = [...path.matchAll(/C ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/g)];
    let previousY = initialY;
    for (const segment of segments) {
      const control1Y = Number(segment[2]); const control2Y = Number(segment[4]); const nextY = Number(segment[6]);
      const low = Math.min(previousY, nextY); const high = Math.max(previousY, nextY);
      assert.ok(control1Y >= low - 0.1 && control1Y <= high + 0.1, 'first control point stays within adjacent values');
      assert.ok(control2Y >= low - 0.1 && control2Y <= high + 0.1, 'second control point stays within adjacent values');
      assert.ok(nextY >= 28 && nextY <= 148, 'rendered curve points stay on the non-negative plot scale');
      previousY = nextY;
    }
  }
});

test('markers retain exact UTC bucket/count coordinates and chart labels remain explicit', () => {
  const output = renderLine();
  const markers = [...output.matchAll(/<circle class="comparison-point" data-count="(\d+)" data-bucket-start="([^"]+)" cx="([\d.]+)" cy="([\d.]+)"/g)];
  assert.equal(markers.length, 12, '24-hour window shows only buckets within its existing boundaries');
  const first = markers[0];
  assert.equal(first[1], '6');
  assert.equal(first[2], '2026-10-05T00:00:00.000Z');
  assert.equal(Number(first[3]), 48);
  assert.equal(Number(first[4]), 148 - 6 / 18 * 120);
  assert.match(output, /class="comparison-point"[^>]+fill="#111d30" stroke="#f59e0b"/);
  assert.match(html, /\.comparison-chart-wrap \.comparison-point \{ stroke-width:2; \}/);
  assert.match(output, /class="comparison-count"[^>]*>6<\/text>/);
  assert.match(output, /class="comparison-gridline"/);
  assert.match(output, /transform="rotate\(-90 20 88\)">Events<\/text>/);
  assert.match(output, />UTC six-hour buckets<\/text>/);
  assert.match(output, /10-05 06Z/);
  assert.match(output, /role="region" tabindex="0" aria-label="Plan tier line chart/);
});

test('table mode and all five category controls remain unchanged', () => {
  assert.equal((html.match(/data-comparison-view="table"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="line"/g) || []).length, 5);
  assert.match(html, /else comparison\(target, comparisons\[spec\.category\]\)/);
  assert.doesNotMatch(html, /data-comparison-category="user_role"/);
});

console.log('comparison line-chart style checks passed');
