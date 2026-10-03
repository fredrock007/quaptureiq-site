import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const start = html.indexOf('  function renderTrend(history) {');
const end = html.indexOf('\n  function renderIncidents(items) {', start);
assert.notEqual(start, -1, 'renderTrend exists');
assert.notEqual(end, -1, 'renderTrend has a clear function boundary');
const renderTrendSource = html.slice(start, end);

function render(history) {
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        attrs: {}, innerHTML: '', textContent: '',
        setAttribute(name, value) { this.attrs[name] = value; },
      });
      return elements.get(selector);
    },
  };
  const context = {
    document,
    history,
    number: (value) => Number(value || 0).toLocaleString('en-US'),
    safe: (value) => String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char])),
    svgSafe: (value) => String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char])),
    localTimestamp: (value) => new Date(value).toISOString(),
    trendTimeLabel: (value) => new Date(value).toISOString().slice(11, 19),
  };
  vm.createContext(context);
  vm.runInContext(`${renderTrendSource}\nrenderTrend(history);`, context);
  return elements;
}

test('latency chart labels both axes and gives each sample a readable time tick', () => {
  assert.match(html, /Response time \(ms\)/);
  assert.match(html, />Time<\/text>/);
  const samples = [
    { at: '2026-10-02T10:00:00Z', requests: { p50_ms: 4, p95_ms: 8, p99_ms: 12 } },
    { at: '2026-10-02T10:01:00Z', requests: { p50_ms: 5, p95_ms: 9, p99_ms: 15 } },
  ];
  const elements = render(samples);
  const ticks = elements.get('#trend-axis-labels').innerHTML;
  assert.equal((ticks.match(/<text class="trend-tick"/g) || []).length, samples.length);
  assert.match(ticks, /10:00:00/);
  assert.match(ticks, /10:01:00/);
  assert.match(elements.get('#trend-gridlines').innerHTML, /<text class="trend-tick"/);
  assert.match(elements.get('#trend-gridlines').innerHTML, /<line class="trend-grid"/);
});

test('legend distinguishes p50/p95/p99 and reports sample count plus actual time window', () => {
  const elements = render([
    { at: '2026-10-02T10:00:00Z', requests: { p50_ms: 1, p95_ms: 2, p99_ms: 3 } },
    { at: '2026-10-02T10:01:00Z', requests: { p50_ms: 2, p95_ms: 3, p99_ms: 4 } },
  ]);
  const legend = elements.get('#trend-legend').innerHTML;
  for (const percentile of ['p50 (circle)', 'p95 (square)', 'p99 (diamond)']) assert.ok(legend.includes(percentile));
  assert.match(legend, /border-top:3px solid/);
  assert.match(legend, /border-top:3px dashed/);
  assert.match(legend, /border-top:3px dotted/);
  assert.match(legend, /2 samples · chart time window:/);
  assert.match(legend, /10:00:00\.000Z/);
  assert.match(legend, /10:01:00\.000Z/);
});

test('overlapping percentiles keep identical plotted coordinates and expose exact tooltip values', () => {
  const timestamp = '2026-10-02T10:00:00Z';
  const elements = render([{ at: timestamp, requests: { p50_ms: 7.25, p95_ms: 7.25, p99_ms: 7.25 } }]);
  const coordinates = ['p50', 'p95', 'p99'].map((name) => elements.get(`#trend-${name}`).attrs.points);
  assert.equal(coordinates[0], coordinates[1]);
  assert.equal(coordinates[1], coordinates[2]);
  for (const [name, shape] of [['p50', '<circle'], ['p95', '<rect'], ['p99', '<path']]) {
    const markers = elements.get(`#trend-markers-${name}`).innerHTML;
    assert.ok(markers.includes(shape), `${name} has a distinct marker`);
    assert.ok(markers.includes(`${name} · ${timestamp.replace('00Z', '00.000Z')} · 7.25 ms`), `${name} tooltip has timestamp and exact value`);
  }
  const missing = render([{ at: timestamp, requests: { p50_ms: null, p95_ms: 2, p99_ms: 3 } }]);
  assert.equal(missing.get('#trend-p50').attrs.points, '', 'missing percentile is not plotted as zero');
});
