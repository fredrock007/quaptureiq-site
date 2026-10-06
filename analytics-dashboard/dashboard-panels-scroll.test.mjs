import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const section = (heading) => {
  const start = html.indexOf(`<h2>${heading}</h2>`);
  assert.notEqual(start, -1, `${heading} panel exists`);
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, `${heading} panel has a section boundary`);
  return html.slice(start, end);
};

const panelScroll = html.match(/\.panel-scroll\s*\{([^}]*)\}/)?.[1];
assert.ok(panelScroll, 'panel data regions use shared bounded scrolling');
assert.match(panelScroll, /max-height\s*:\s*20rem/);
assert.match(panelScroll, /overflow\s*:\s*auto/);
assert.match(panelScroll, /overscroll-behavior\s*:\s*contain/);
assert.match(panelScroll, /-webkit-overflow-scrolling\s*:\s*touch/);
assert.match(panelScroll, /scrollbar-color/);

const incidents = section('Recent system incidents');
assert.ok(incidents.indexOf('<p class="hint">') < incidents.indexOf('id="incident-feed"'), 'incident explanation stays outside its scroll area');
assert.match(incidents, /id="incident-feed"[^>]*class="incident-list panel-scroll"[^>]*role="region"[^>]*tabindex="0"/);

const timing = section('How long answers take to appear');
assert.ok(timing.indexOf('<p class="hint">') < timing.indexOf('id="answer-display-summaries"'), 'timing explanation stays visible outside the summary scroll area');
assert.match(timing, /id="answer-display-summaries"[^>]*class="timing-summary-grid panel-scroll"[^>]*role="region"[^>]*tabindex="0"/);
assert.ok(timing.indexOf('<h3>Recent completed answers</h3>') < timing.indexOf('id="answer-display-timings"'), 'completed-answer heading remains above its table');

const tableRules = html.match(/#answer-display-timings tbody,#next tbody,#failures tbody\s*\{([^}]*)\}/)?.[1];
assert.ok(tableRules, 'tabular rows use a separate scroll viewport');
assert.match(tableRules, /max-height\s*:\s*12rem/);
assert.match(tableRules, /overflow-y\s*:\s*auto/);
assert.match(html, /#answer-display-timings thead,#answer-display-timings tbody tr,#next thead,#next tbody tr,#failures thead,#failures tbody tr\s*\{[^}]*display\s*:\s*table/);
assert.match(html, /#answer-display-timings thead th,#next thead th,#failures thead th\s*\{[^}]*background\s*:\s*#111d30/);

for (const [id, label, heading] of [
  ['next', 'Answer-next usage data', 'Answer-next usage'],
  ['failures', 'Normalized failure stages data', 'Normalized failure stages'],
]) {
  const card = section(heading);
  assert.match(card, new RegExp(`id="${id}"[^>]*role="region"[^>]*aria-label="${label}"[^>]*tabindex="0"`));
}
assert.match(html, /#next,#failures\s*\{[^}]*max-height\s*:\s*16rem/);
assert.match(html, /#answer-display-timings,#next,#failures\s*\{[^}]*overflow-y\s*:\s*hidden/);

const timingRendererStart = html.indexOf('  function renderAnswerDisplayTimings(items) {');
const timingRendererEnd = html.indexOf('\n  function answerDurationLabel', timingRendererStart);
assert.notEqual(timingRendererStart, -1);
const timingRenderer = html.slice(timingRendererStart, timingRendererEnd);
assert.match(timingRenderer, /<thead><tr><th>Mode<\/th><th>Time until answer appears/);
assert.match(timingRenderer, /<tbody tabindex="0" aria-label="Scrollable completed answer rows">/);
assert.match(timingRenderer, /rows\.map\(\(item\)/, 'all existing completed-answer rows remain mapped in order');
assert.match(timingRenderer, /localTimestamp\(item\.occurred_at\)/, 'existing timing timestamps remain bound');

const rowsStart = html.indexOf('  function rows(target, values, total, label) {');
const rowsEnd = html.indexOf('\n  function setCollectionStatus', rowsStart);
const rowsRenderer = html.slice(rowsStart, rowsEnd);
assert.match(rowsRenderer, /target\.id === 'next'/);
assert.match(rowsRenderer, /target\.id === 'failures'/);
assert.match(rowsRenderer, /<tbody' \+ scrollAttributes \+ '>/);
assert.match(rowsRenderer, /entries\.map\(\(\[key,value\]\)/, 'existing usage values remain mapped in sorted order');

console.log('four-panel scroll structure checks passed');
