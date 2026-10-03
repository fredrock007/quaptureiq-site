import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const start = html.indexOf('  function renderAnswerDisplayTimings(items) {');
const end = html.indexOf('\n  function renderOperational', start);
assert.notEqual(start, -1, 'answer timing renderer exists');
assert.notEqual(end, -1, 'answer timing renderer has a clear boundary');
const renderer = html.slice(start, end);
const summaryStart = html.indexOf('  function answerDurationLabel(durationMs) {');
const summaryEnd = html.indexOf('\n  function renderOperational', summaryStart);
assert.notEqual(summaryStart, -1, 'period summary renderer exists');
assert.notEqual(summaryEnd, -1, 'period summary renderer has a clear boundary');
const summaryRenderer = html.slice(summaryStart, summaryEnd);

function render(items) {
  const target = { className: '', innerHTML: '', textContent: '' };
  const context = {
    items,
    document: { querySelector(selector) {
      assert.equal(selector, '#answer-display-timings');
      return target;
    } },
    number: (value) => Number(value || 0).toLocaleString('en-US'),
    safe: (value) => String(value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c])),
    localTimestamp: (value) => `SAST(${value})`,
    friendlyLabel: (value) => ({
      question: 'Question', diagram_labels: 'Diagram labels',
      locate: 'Locate', source_analysis: 'Source analysis',
    }[value] || String(value)),
  };
  vm.createContext(context);
  vm.runInContext(`${renderer}\nrenderAnswerDisplayTimings(items);`, context);
  return target;
}

test('renders completed phone-visible timing fields separately from API latency', () => {
  assert.match(html, /Time until answer appears on phone/);
  assert.match(html, /first rendered frame/);
  assert.match(html, /separate from API request latency/);
  assert.match(html, /renderAnswerDisplayTimings\(report\.answer_display_timings \|\| \[\]\)/);
  const timestamp = '2026-10-02T10:00:00.000+00:00';
  const target = render([{ mode: 'diagram_labels', duration_ms: 1_245, occurred_at: timestamp }]);
  assert.match(target.innerHTML, /Diagram labels/);
  assert.match(target.innerHTML, /1,245 ms/);
  assert.match(target.innerHTML, new RegExp(`datetime="${timestamp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(target.innerHTML, /SAST\(2026-10-02T10:00:00\.000\+00:00\)/);
  assert.match(target.innerHTML, /First displayed \(local time\)/);
});

test('omits failed or malformed records and safely renders an empty state', () => {
  const target = render([
    { mode: 'locate', outcome: 'failed', occurred_at: '2026-10-02T10:00:00Z', duration_ms: null },
    { mode: '<img src=x>', occurred_at: '2026-10-02T10:00:00Z', duration_ms: 10 },
    { mode: 'question', occurred_at: null, duration_ms: 10 },
  ]);
  assert.equal(target.textContent, 'No completed answer timings recorded.');
  assert.equal(target.className, 'event-table-wrap empty');
  assert.doesNotMatch(target.innerHTML, /<img/);
});

function renderSummaries(status, summary) {
  const elements = new Map();
  const document = { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, { textContent: '', innerHTML: '' });
    return elements.get(selector);
  } };
  const context = {
    document, status, summary,
    number: (value) => Number(value || 0).toLocaleString('en-US'),
    safe: (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
    localTimestamp: (value) => `SAST(${value})`,
  };
  vm.createContext(context);
  vm.runInContext(`${summaryRenderer}\nrenderAnswerDisplaySummaries(status, summary);`, context);
  return elements;
}

test('renders API-backed day, week, and month averages with counts, failures, and coverage', () => {
  const period = (completed, average_duration_ms, slowest_duration_ms, failed, cancelled) => ({
    completed, average_duration_ms, slowest_duration_ms, failed, cancelled,
  });
  const elements = renderSummaries(
    { configured: true, available: true, retention_days: 90 },
    {
      observed_from_at: '2026-09-01T10:00:00Z',
      periods: {
        today: period(2, 875, 1200, 1, 0),
        last_7_days: period(10, 1500, 8900, 2, 1),
        last_30_days: period(20, 2400, 12000, 4, 3),
      },
    },
  );
  const htmlSummary = elements.get('#answer-display-summaries').innerHTML;
  for (const label of ['Today (South Africa time)', 'Last 7 days', 'Last 30 days', '875 ms', '1.50 s', '2.40 s', 'Recorded completed answers: 20', 'Recorded failed answers: 4', 'Recorded cancellations: 3']) {
    assert.ok(htmlSummary.includes(label), `summary includes ${label}`);
  }
  assert.match(elements.get('#answer-display-coverage').textContent, /SAST\(2026-09-01T10:00:00Z\)/);
  assert.match(elements.get('#answer-display-summary-status').textContent, /retention 90 days/);
});

test('does not invent averages for empty, disabled, or unavailable timing data', () => {
  const period = { completed: 0, average_duration_ms: null, slowest_duration_ms: null, failed: 0, cancelled: 0 };
  const empty = renderSummaries(
    { configured: true, available: true, retention_days: 90 },
    { observed_from_at: null, periods: { today: period, last_7_days: period, last_30_days: period } },
  );
  assert.match(empty.get('#answer-display-summaries').innerHTML, /Average display time: <strong>—<\/strong>/);
  assert.match(empty.get('#answer-display-summaries').innerHTML, /No completed answers recorded in this period/);
  assert.match(empty.get('#answer-display-coverage').textContent, /coverage has not yet been established/);

  const disabled = renderSummaries({ configured: false, available: false }, null);
  assert.equal(disabled.get('#answer-display-summary-status').textContent, 'Phone-display timing collection is disabled for this API.');
  const unavailable = renderSummaries({ configured: true, available: false }, null);
  assert.equal(unavailable.get('#answer-display-summary-status').textContent, 'Phone-display timing summaries are unavailable.');
});
