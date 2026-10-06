import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const tabs = [
  ['overview', 'Overview', ['requested', 'succeeded', 'failed', 'duration', 'active-devices']],
  ['system-health', 'System Health', ['ops-status', 'ops-latency', 'telemetry-coverage', 'incident-feed']],
  ['app-activity', 'App Activity', ['recent-events', 'answer-display-timings']],
  ['usage', 'Usage', ['modes', 'sources', 'next', 'failures']],
  ['product-comparisons', 'Product Comparisons', ['comparison-plan', 'comparison-voice', 'comparison-input', 'comparison-route', 'comparison-signin', 'comparison-role']],
];

const dashboardStart = html.indexOf('<section id="dashboard"');
assert.notEqual(dashboardStart, -1);
const dashboardHtml = html.slice(dashboardStart, html.indexOf('<footer', dashboardStart));
for (const [key, label] of tabs) {
  assert.match(dashboardHtml, new RegExp(`id="tab-${key}"[^>]*role="tab"[^>]*>${label}</button>`));
  assert.match(dashboardHtml, new RegExp(`id="panel-${key}"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-${key}"`));
}
assert.match(dashboardHtml, /id="tab-overview"[^>]*aria-selected="true"[^>]*tabindex="0"/);
assert.match(dashboardHtml, /id="panel-overview"[^>]*role="tabpanel"[^>]*tabindex="0">/);
for (const [key] of tabs.slice(1)) {
  assert.match(dashboardHtml, new RegExp(`id="tab-${key}"[^>]*aria-selected="false"[^>]*tabindex="-1"`));
  assert.match(dashboardHtml, new RegExp(`id="panel-${key}"[^>]*hidden`));
}

const panelsInDocumentOrder = tabs
  .map((tab) => ({ tab, start: dashboardHtml.indexOf(`id="panel-${tab[0]}"`) }))
  .sort((left, right) => left.start - right.start);
for (let index = 0; index < panelsInDocumentOrder.length; index += 1) {
  const { tab, start } = panelsInDocumentOrder[index];
  const panelEnd = panelsInDocumentOrder[index + 1]?.start ?? dashboardHtml.length;
  const panelHtml = dashboardHtml.slice(start, panelEnd);
  for (const sectionId of tab[2]) {
    assert.ok(panelHtml.includes(`id="${sectionId}"`), `${sectionId} stays in ${tab[1]}`);
    assert.equal((html.match(new RegExp(`id="${sectionId}"`, 'g')) || []).length, 1, `${sectionId} remains unique`);
  }
}
assert.ok(html.indexOf('id="auth-heading"') < dashboardStart, 'Owner sign-in remains dashboard-wide');
assert.ok(html.indexOf('id="connection-heading"') < dashboardStart, 'Secure connection remains dashboard-wide');

const setupMatch = html.match(/(function setupDashboardTabs\(root = document\) \{[\s\S]*?\n  \})\n\n  setupDashboardTabs\(\);/);
assert.ok(setupMatch, 'tab behavior is isolated from dashboard data loading');

class FakeTab {
  constructor() { this.listeners = {}; this.attributes = {}; this.focused = false; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  getAttribute(name) { return this.attributes[name]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  fire(type, event = {}) { this.listeners[type](event); }
}

const fakeTabs = tabs.map(([key]) => {
  const tab = new FakeTab();
  tab.attributes['aria-controls'] = `panel-${key}`;
  return tab;
});
const fakePanels = new Map(tabs.map(([key]) => [`panel-${key}`, { hidden: key !== 'overview' }]));
const root = {
  querySelector() { return { querySelectorAll() { return fakeTabs; } }; },
  getElementById(id) { return fakePanels.get(id); },
};
const setupDashboardTabs = vm.runInNewContext(`(${setupMatch[1]})`, {});
setupDashboardTabs(root);
const selection = () => fakeTabs.map((tab) => tab.attributes['aria-selected'] === 'true');

fakeTabs[3].fire('click');
assert.deepEqual(selection(), [false, false, false, true, false]);
assert.equal(fakePanels.get('panel-usage').hidden, false);
assert.equal(fakePanels.get('panel-overview').hidden, true);

let prevented = false;
fakeTabs[3].fire('keydown', { key: 'ArrowRight', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.deepEqual(selection(), [false, false, false, false, true]);
assert.equal(fakeTabs[4].focused, true);

fakeTabs[2].fire('keydown', { key: 'End', preventDefault() {} });
assert.deepEqual(selection(), [false, false, false, false, true]);
fakeTabs[4].fire('keydown', { key: 'Home', preventDefault() {} });
assert.deepEqual(selection(), [true, false, false, false, false]);
fakeTabs[0].fire('keydown', { key: 'ArrowLeft', preventDefault() {} });
assert.deepEqual(selection(), [false, false, false, false, true]);

console.log('dashboard tab presentation checks passed');
