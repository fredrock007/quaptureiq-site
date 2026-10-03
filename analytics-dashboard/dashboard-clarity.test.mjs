import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('threshold explanation is a compact keyboard-operable disclosure beside System health', () => {
  assert.match(html, /<div class="ops-heading"><h2>System health<\/h2><details class="threshold-info">/);
  assert.match(html, /<summary aria-label="Alert threshold information" aria-controls="threshold-info-content"[^>]*>i<\/summary>/);
  assert.match(html, /<details class="threshold-info"><summary/);
  assert.match(html, /class="threshold-copy" role="note"/);
  assert.doesNotMatch(html, /<section class="card section"><h2>Alert thresholds<\/h2>/);
  for (const unchangedThreshold of ['p95 ≥ 1 s', 'p95 ≥ 3 s', 'HTTP 5xx &gt; 1%', 'HTTP 5xx &gt; 5%', 'CPU ≥ 70%', 'CPU ≥ 85%', 'memory ≥ 75%', 'memory ≥ 90%']) {
    assert.ok(html.includes(unchangedThreshold), `threshold remains documented: ${unchangedThreshold}`);
  }
});

test('collection status distinguishes disabled, unavailable, never received, recent, and expired-detail states', () => {
  const start = html.indexOf('  function telemetryStatus(entry) {');
  const end = html.indexOf('\n  function renderTelemetryStatus', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    entry: null,
    localTimestamp: (timestamp) => `local(${timestamp})`,
  };
  vm.createContext(context);
  const source = html.slice(start, end);
  const status = (entry) => {
    context.entry = entry;
    return vm.runInContext(`${source}\ntelemetryStatus(entry);`, context);
  };
  assert.deepEqual({ ...status({ configured: false, available: true }) }, { state: 'disabled', label: 'Disabled' });
  assert.deepEqual({ ...status({ configured: true, available: false }) }, { state: 'unavailable', label: 'Unavailable' });
  assert.deepEqual({ ...status({ configured: true, available: true, history_known: true, last_received_at: null, last_successful_event_at: null }) }, { state: 'ready', label: 'Ready — waiting for the first event' });
  assert.deepEqual({ ...status({ configured: true, available: true, history_known: true, last_received_at: '2026-10-02T10:00:00Z', last_successful_event_at: '2026-10-02T10:00:00Z' }) }, { state: 'receiving', label: 'Receiving data — last received local(2026-10-02T10:00:00Z)' });
  assert.deepEqual({ ...status({ configured: true, available: true, history_known: true, last_received_at: null, last_successful_event_at: '2026-09-30T10:00:00Z' }) }, { state: 'no-recent-data', label: 'No recent data — last received local(2026-09-30T10:00:00Z)' });
  assert.deepEqual({ ...status({ configured: true, available: true, history_known: false, last_received_at: null, last_successful_event_at: null }) }, { state: 'unavailable', label: 'Unavailable — prior event history is unknown' });
  assert.deepEqual({ ...status({}) }, { state: 'unavailable', label: 'Unavailable' });
});

test('metric statuses use explicit availability and sampling evidence; zero readings are not disabled', () => {
  const start = html.indexOf('  function metricStatus(entry) {');
  const end = html.indexOf('\n  function renderMetricStatus', start);
  const context = { entry: null, localTimestamp: (timestamp) => `local(${timestamp})` };
  vm.createContext(context);
  const source = html.slice(start, end);
  const status = (entry) => {
    context.entry = entry;
    return vm.runInContext(`${source}\nmetricStatus(entry);`, context);
  };
  assert.deepEqual({ ...status({ configured: false, available: true }) }, { state: 'disabled', label: 'Disabled' });
  assert.deepEqual({ ...status({ configured: null, available: false }) }, { state: 'unavailable', label: 'Unavailable' });
  assert.deepEqual({ ...status({ configured: null, available: true, sampled_at: '2026-10-02T10:00:00Z', has_sample: false }) }, { state: 'ready', label: 'Ready — waiting for data' });
  assert.deepEqual({ ...status({ configured: null, available: true, sampled_at: '2026-10-02T10:00:00Z', has_sample: true }) }, { state: 'sampled', label: 'Sampled at local(2026-10-02T10:00:00Z)' });
});

test('active sessions use all requested count bands, readable labels and reduced-motion rules', () => {
  const start = html.indexOf('  function activeSessionPresentation(count) {');
  const end = html.indexOf('\n  function failureCardHasFailures', start);
  const context = { count: 0, number: (value) => String(value) };
  vm.createContext(context);
  const source = html.slice(start, end);
  const present = (count) => {
    context.count = count;
    return vm.runInContext(`${source}\nactiveSessionPresentation(count);`, context);
  };
  assert.equal(present(0).level, 'neutral');
  assert.equal(present(0).label, 'No active sessions reported in the last 2 minutes');
  for (const [count, level] of [[1, 'green'], [99, 'green'], [100, 'orange'], [499, 'orange'], [500, 'red'], [999, 'red'], [1000, 'black'], [4999, 'black'], [5000, 'red-pulse']]) {
    assert.equal(present(count).level, level, `count ${count} uses ${level}`);
    assert.match(present(count).label, /active session/);
  }
  assert.match(present(5000).label, /not an outage signal/);
  assert.match(html, /prefers-reduced-motion:reduce\) \{ \.session-count\[data-level="red-pulse"\] \{ animation:none; \} \}/);
  assert.match(html, /id="active-devices" class="metric"/);
  assert.match(html, /id="active-session-state" class="telemetry-status" role="status" aria-live="polite"/);
});

test('failed-answer card is red only for a positive failure count', () => {
  const start = html.indexOf('  function failureCardHasFailures(failedCount) {');
  const end = html.indexOf('\n  async function initialiseAuthClient', start);
  const context = { failedCount: 0 };
  vm.createContext(context);
  const source = html.slice(start, end);
  const hasFailures = (failedCount) => {
    context.failedCount = failedCount;
    return vm.runInContext(`${source}\nfailureCardHasFailures(failedCount);`, context);
  };
  assert.equal(hasFailures(0), false);
  assert.equal(hasFailures(1), true);
  assert.match(html, /\.failure-card\[data-has-failures="true"\].*background:#fff1f1/s);
  assert.match(html, /number\(failed\) \+ ' failed of ' \+ number\(requested\)/);
  assert.match(html, /failure rate/);
});
