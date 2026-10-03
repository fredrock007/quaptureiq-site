import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const start = html.indexOf('  function renderOperational(data) {');
const end = html.indexOf('\n  const friendlyLabels', start);
assert.notEqual(start, -1, 'operational renderer exists');
assert.notEqual(end, -1, 'operational renderer has a boundary');
const renderer = html.slice(start, end);

function render(data) {
  const elements = new Map();
  const statuses = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { dataset: {}, textContent: '' });
      return elements.get(selector);
    },
  };
  const context = {
    document,
    number: (value) => Number(value || 0).toLocaleString('en-US'),
    localTimestamp: (value) => `local(${value})`,
    metricFeed: (configured, available, sampled_at, has_sample) => ({ configured, available, sampled_at, has_sample }),
    renderMetricStatus: (id, entry) => statuses.set(id, entry),
    renderTrend() {},
    renderIncidents() {},
    data,
  };
  vm.createContext(context);
  vm.runInContext(`${renderer}\nrenderOperational(data);`, context);
  return { elements, statuses };
}

test('system-health cards map the operational report fields and preserve metric meaning', () => {
  const { elements } = render({
    sampled_at: '2026-10-03T01:00:00Z',
    requests: {
      p50_ms: 12.4, p95_ms: 25.6, p99_ms: 44.4, rps: 0.24,
      in_flight_requests: 0, http_5xx_percent: 4.2, http_5xx: 2, request_count: 48,
      incidents: [],
    },
    current: {
      container: {
        available: true, cpu_percent_of_limit: 21.4, memory_percent: 45.3,
        memory_bytes: 52428800, memory_limit_bytes: 104857600,
      },
      storage: { available: true, used_percent: 30, free_bytes: 2147483648 },
      network: { available: true, in_bytes_per_second: 120.4, out_bytes_per_second: 500.7 },
    },
    analytics_queue: { depth: 1, capacity: 512, dropped_events: 0 },
    database: {
      configured: true, available: true, active_connections: 5, max_connections: 100,
      connection_percent: 5, metrics_latency_ms: 18, sampled_at: '2026-10-03T01:00:00Z',
    },
    storage_io: {
      configured: true, available: true, read_bytes_per_second: 1024,
      write_bytes_per_second: 2048, source: 'host /proc/diskstats',
      sampled_at: '2026-10-03T01:00:00Z',
    },
  });
  const get = (id) => elements.get(`#${id}`).textContent;
  assert.equal(get('ops-latency'), '12 ms / 26 ms / 44 ms');
  assert.equal(get('ops-rps'), '0.240');
  assert.equal(get('ops-inflight'), '0');
  assert.equal(get('ops-errors'), '4.2%');
  assert.equal(get('ops-errors-note'), '2 server errors / 48 requests · last 5 min');
  assert.equal(get('ops-cpu'), '21.4%');
  assert.equal(get('ops-memory'), '45.3%');
  assert.equal(get('ops-disk'), '30% used');
  assert.equal(get('ops-network'), '120 / 501 B/s');
  assert.equal(get('ops-queue'), '1 / 512');
  assert.equal(get('ops-database'), '5 / 100');
  assert.equal(get('ops-database-note'), '18 ms metrics request · 5% connections');
  assert.equal(get('ops-disk-io'), '1,024 / 2,048 B/s');
  assert.equal(get('ops-disk-io-note'), 'API-reported source: host /proc/diskstats.');
});

test('missing samples and unavailable feeds are not rendered as zero or connected', () => {
  const { elements, statuses } = render({
    sampled_at: '2026-10-03T01:00:00Z',
    requests: { request_count: 0, rps: 0, in_flight_requests: 0, incidents: [] },
    current: {
      container: { available: true, memory_bytes: 52428800, memory_limit_bytes: null },
      storage: { available: false },
      network: { available: true },
    },
    analytics_queue: { depth: 0 },
    database: { configured: false, available: false },
    storage_io: { configured: true, available: true, source: 'host /proc/diskstats', reason: 'Collecting a second sample for host disk throughput.' },
  });
  const get = (id) => elements.get(`#${id}`).textContent;
  assert.equal(get('ops-cpu'), 'No percentage sample');
  assert.match(get('ops-cpu-note'), /does not report which condition applies/);
  assert.equal(statuses.get('ops-cpu-status').available, false);
  assert.equal(get('ops-memory'), '50 MiB used');
  assert.equal(get('ops-memory-note'), '50 / no configured limit');
  assert.equal(get('ops-disk'), 'Unavailable');
  assert.equal(get('ops-network'), 'Sampling…');
  assert.equal(get('ops-queue'), 'Unavailable');
  assert.equal(get('ops-database'), 'Not configured');
  assert.equal(statuses.get('ops-database-status').configured, false);
  assert.equal(get('ops-disk-io'), 'Warming up');
  assert.equal(statuses.get('ops-disk-io-status').has_sample, false);
  assert.match(html, /const activeSessions = report\.active_app_sessions;/);
  assert.match(html, /activeSessionPresentation\(activeSessions\)/);
  assert.match(html, /report\.snapshot_at \? 'Sampled at '/);
  assert.match(html, /No active sessions reported in the last 2 minutes/);
});
