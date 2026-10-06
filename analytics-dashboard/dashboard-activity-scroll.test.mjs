import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const cardStart = html.indexOf('<h2>Recent timestamped product activity</h2>');
const cardEnd = html.indexOf('</section>', cardStart);
assert.notEqual(cardStart, -1, 'activity card exists');
assert.notEqual(cardEnd, -1, 'activity card has a section boundary');
const card = html.slice(cardStart, cardEnd);
const region = card.match(/<div id="recent-events"([^>]*)>/)?.[1];
assert.ok(region, 'existing activity wrapper remains the scroll region');
assert.match(region, /role="region"/);
assert.match(region, /aria-label="Recent timestamped product activity"/);
assert.match(region, /tabindex="0"/, 'region can receive keyboard focus');

const scrollStyle = html.match(/#recent-events\s*\{([^}]*)\}/)?.[1];
assert.ok(scrollStyle, 'activity wrapper has dedicated bounded scrolling styles');
assert.match(scrollStyle, /max-height\s*:\s*24rem/);
assert.match(scrollStyle, /overflow\s*:\s*auto/);
assert.match(scrollStyle, /overscroll-behavior\s*:\s*contain/);
assert.match(scrollStyle, /scrollbar-color/);
assert.match(html, /#recent-events::-webkit-scrollbar-thumb\s*\{[^}]*background\s*:\s*var\(--cyan\)/);
assert.match(html, /#recent-events thead th\s*\{[^}]*position\s*:\s*sticky/);

const rendererStart = html.indexOf('  function renderEvents(items) {');
const rendererEnd = html.indexOf('\n  function renderAnswerDisplayTimings', rendererStart);
assert.notEqual(rendererStart, -1, 'activity renderer exists');
assert.notEqual(rendererEnd, -1, 'activity renderer boundary exists');
const renderer = html.slice(rendererStart, rendererEnd);
assert.match(renderer, /target\.innerHTML\s*=\s*'<table><thead>/, 'existing table/header rendering is preserved');
assert.match(renderer, /items\.map\(\(event\)/, 'all supplied rows remain rendered in their existing order');
assert.match(renderer, /localTimestamp\(event\.occurred_at\)/, 'existing timestamp binding remains intact');

console.log('activity scroll region checks passed');
