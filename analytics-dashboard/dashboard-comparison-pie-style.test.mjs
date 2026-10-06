import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const start = html.indexOf('  const comparisonColors = [');
const end = html.indexOf('\n  function renderComparisonBar', start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);
const pieRenderer = html.slice(start, end);

function render(entries, choices, label = 'Plan tier') {
  const target = { innerHTML: '' };
  const context = {
    target,
    value: { total: entries.reduce((sum, [, count]) => sum + count, 0), counts: Object.fromEntries(entries) },
    choices,
    label,
    comparisonModel: (data) => ({ data, total: data.total, entries: Object.entries(data.counts || {}) }),
    safe: (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    friendlyLabel: (key) => ({ free: 'Free', student: 'Student', professional: 'Professional', email: 'Email', google: 'Google' }[key] || key),
    number: (number) => Number(number || 0).toLocaleString('en-US'),
  };
  vm.createContext(context);
  vm.runInContext(`${pieRenderer}\nrenderComparisonPie(target, value, label, choices);`, context);
  return target.innerHTML;
}

function colorsByValue(output) {
  return Object.fromEntries([...output.matchAll(/class="comparison-pie-top" data-value="([^"]+)" data-count="([^"]+)" data-color="([^"]+)"/g)]
    .map(([, value, count, color]) => [value, { count, color }]));
}

test('sampled reference colors map stably to the first five ordered values', () => {
  const entries = [['free', 4], ['student', 7], ['professional', 9], ['fourth', 3], ['fifth', 5]];
  const palette = ['#A254FD', '#FC4410', '#EB8821', '#F5C542', '#35B96F'];
  const first = colorsByValue(render(entries, entries.map(([key]) => key)));
  const reordered = colorsByValue(render([...entries].reverse(), entries.map(([key]) => key)));
  entries.forEach(([key, count], index) => {
    assert.deepEqual(first[key], { count: String(count), color: palette[index] });
    assert.equal(reordered[key].color, palette[index], `${key} retains its color when report entry order changes`);
  });
});

test('each supported card renders every supplied count and stable value label', () => {
  const cards = [
    ['Plan tier', ['free', 'student', 'professional']],
    ['Selected voice', ['quapture_voice', 'sky']],
    ['Image input', ['choose_photo', 'take_photo', 'scan_document']],
    ['Entry route', ['q_lens_home', 'dashboard_route']],
    ['Sign-in method', ['email', 'google']],
  ];
  for (const [label, choices] of cards) {
    const entries = choices.map((choice, index) => [choice, index + 4]);
    const output = render(entries, choices, label);
    const rendered = colorsByValue(output);
    assert.deepEqual(Object.keys(rendered).sort(), choices.slice().sort(), `${label} does not omit values`);
    entries.forEach(([choice, count]) => assert.equal(rendered[choice].count, String(count)));
    assert.match(output, new RegExp(`<strong>${entries[0][1]}</strong>`));
    assert.match(output, new RegExp(`${label} three-dimensional pie chart`));
  }
  assert.doesNotMatch(html, /data-comparison-category="user_role"/);
});

test('pie uses layered SVG depth/highlights and reserves unclipped responsive space', () => {
  const output = render([['free', 7], ['student', 5]], ['free', 'student']);
  assert.equal((output.match(/class="comparison-pie-side"/g) || []).length, 2);
  assert.equal((output.match(/class="comparison-pie-top"/g) || []).length, 2);
  assert.match(output, /transform="translate\(0 22\)"/);
  assert.match(output, /comparison-pie-gloss|url\(#comparison-pie-plan-tier-gloss\)/);
  assert.match(output, /clip-path="url\(#comparison-pie-plan-tier-clip\)"/);
  assert.match(html, /\.comparison-pie-stage[^}]*min-height:310px[^}]*overflow:visible/);
  assert.match(html, /\.comparison-pie \{[^}]*width:min\(100%,340px\)[^}]*height:auto[^}]*overflow:visible/);
  assert.match(output, /viewBox="0 0 320 270"/);
});

test('Table, Line, and Bar modes and the current Table default remain available', () => {
  assert.equal((html.match(/data-comparison-view="table"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="line"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="pie"/g) || []).length, 5);
  assert.equal((html.match(/data-comparison-view="bar"/g) || []).length, 5);
  assert.match(html, /comparisonSpecs\.forEach\(\(spec\) => \{ comparisonViews\[spec\.category\] = 'table'; \}\)/);
  assert.match(html, /if \(comparisonViews\[spec\.category\] === 'line'\) renderComparisonLine/);
  assert.match(html, /else if \(comparisonViews\[spec\.category\] === 'bar'\) renderComparisonBar/);
  assert.doesNotMatch(html, /data-comparison-category="user_role"/);
});

console.log('comparison pie style checks passed');
