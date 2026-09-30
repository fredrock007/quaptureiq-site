import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const pageScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('supabaseLibrarySources'));

assert.ok(pageScript, 'dashboard inline script exists');

function runDashboard(loadBehavior, {
  localSdkAvailable = false,
  session = null,
  report = {},
  storedConfig = null,
} = {}) {
  const elements = new Map();
  const requestedScripts = [];
  const oauthCalls = [];
  const fetchRequests = [];
  const intervals = [];
  const makeElement = () => ({
    value: '',
    hidden: false,
    disabled: false,
    className: '',
    dataset: {},
    textContent: '',
    innerHTML: '',
    handlers: {},
    addEventListener(eventName, handler) { this.handlers[eventName] = handler; },
  });
  const document = {
    visibilityState: 'visible',
    querySelector(selector) {
      const id = selector.slice(1);
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    createElement(tagName) {
      assert.equal(tagName, 'script');
      return { remove() {}, src: '', async: false, onload: null, onerror: null };
    },
    head: {
      appendChild(script) {
        requestedScripts.push(script.src);
        loadBehavior({ script, requestedScripts, context });
      },
    },
  };
  const context = {
    console,
    document,
    location: { href: 'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/' },
    localStorage: {
      getItem(key) {
        return key === 'qaptureiq-analytics-public-config' && storedConfig
          ? JSON.stringify(storedConfig) : null;
      },
      setItem() {},
      removeItem() {},
    },
    setTimeout,
    clearTimeout,
    setInterval(callback, milliseconds) {
      const interval = { callback, milliseconds, cleared: false };
      intervals.push(interval);
      return intervals.length;
    },
    clearInterval(id) {
      if (intervals[id - 1]) intervals[id - 1].cleared = true;
    },
    async fetch(url, options) {
      assert.equal(url, 'https://84.12.79.38/analytics/report');
      assert.equal(options.headers.Authorization, 'Bearer test-access-token');
      fetchRequests.push({ url, options });
      return { ok: true, async json() { return report; } };
    },
  };
  context.window = context;
  context.supabase = undefined;

  const client = {
    auth: {
      onAuthStateChange() {},
      async getSession() { return { data: { session } }; },
      async signInWithOAuth(options) {
        oauthCalls.push(options);
        return { error: null };
      },
    },
  };
  const sdk = {
    createClient(url, key, options) {
      assert.equal(url, 'https://project.example.supabase.co');
      assert.equal(key, 'sb_publishable_test_key');
      assert.equal(options.auth.persistSession, true);
      return client;
    },
  };
  context.testSdk = sdk;
  if (localSdkAvailable) context.supabase = sdk;
  vm.createContext(context);
  vm.runInContext(pageScript, context, { timeout: 1000 });
  elements.get('supabase-url').value = 'https://project.example.supabase.co';
  elements.get('supabase-key').value = 'sb_publishable_test_key';
  return { context, elements, oauthCalls, requestedScripts, fetchRequests, intervals };
}

test('uses the locally vendored pinned Supabase client and starts Google OAuth', async () => {
  assert.match(html, /<script src="\.\/vendor\/supabase-js-2\.117\.2\.js" integrity="sha384-[^"]+" crossorigin="anonymous"><\/script>/);
  const app = runDashboard(() => assert.fail('local SDK should avoid a CDN request'), {
    localSdkAvailable: true,
  });

  await app.elements.get('auth-form').handlers.submit({ preventDefault() {} });

  assert.deepEqual(app.requestedScripts, []);
  assert.equal(app.oauthCalls.length, 1);
  assert.equal(app.oauthCalls[0].provider, 'google');
  assert.equal(
    app.oauthCalls[0].options.redirectTo,
    'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/',
  );
  assert.match(app.elements.get('auth-status').textContent, /Redirecting to Google/);
});

test('vendored Supabase JS 2.117.2 exposes the browser client factory', async () => {
  const sourceBytes = await readFile(new URL('./vendor/supabase-js-2.117.2.js', import.meta.url));
  const source = sourceBytes.toString('utf8');
  const integrity = `sha384-${createHash('sha384').update(sourceBytes).digest('base64')}`;
  assert.ok(html.includes(`integrity="${integrity}"`), 'vendored client integrity matches the page');
  const browser = {
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch,
  };
  vm.createContext(browser);
  browser.window = browser;
  browser.self = browser;
  vm.runInContext(source, browser, { timeout: 1000 });
  assert.equal(typeof browser.supabase?.createClient, 'function');
});

test('falls back to the pinned secondary CDN and starts Google OAuth', async () => {
  const app = runDashboard(({ script, requestedScripts, context }) => {
    if (requestedScripts.length === 1) {
      script.onerror();
      return;
    }
    context.supabase = context.testSdk;
    script.onload();
  });

  await app.elements.get('auth-form').handlers.submit({ preventDefault() {} });

  assert.deepEqual(app.requestedScripts, [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2',
    'https://unpkg.com/@supabase/supabase-js@2.117.2',
  ]);
  assert.equal(app.oauthCalls.length, 1);
  assert.equal(app.oauthCalls[0].provider, 'google');
  assert.equal(
    app.oauthCalls[0].options.redirectTo,
    'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/',
  );
  assert.match(app.elements.get('auth-status').textContent, /Redirecting to Google/);
});

test('shows a clear sign-in message when both pinned client sources fail', async () => {
  const app = runDashboard(({ script }) => script.onerror());

  await app.elements.get('auth-form').handlers.submit({ preventDefault() {} });

  assert.equal(app.requestedScripts.length, 2);
  assert.match(app.elements.get('auth-status').textContent, /Google sign-in is temporarily unavailable/);
  assert.doesNotMatch(app.elements.get('auth-status').textContent, /authClient|undefined|null/);
  assert.equal(app.oauthCalls.length, 0);
  assert.equal(app.elements.get('sign-in').disabled, false);
});


test('restores the saved Google session, auto-loads metrics, and refreshes automatically', async () => {
  const app = runDashboard(() => assert.fail('local SDK should avoid a CDN request'), {
    localSdkAvailable: true,
    session: { access_token: 'test-access-token' },
    storedConfig: {
      supabaseUrl: 'https://project.example.supabase.co',
      supabasePublishableKey: 'sb_publishable_test_key',
    },
    report: { collection_enabled: true },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.fetchRequests.length, 1, 'saved session loads metrics without another click');
  assert.equal(app.elements.get('collection-status').dataset.state, 'enabled');
  assert.equal(app.elements.get('collection-status-label').textContent, 'Analytics collection enabled');
  assert.doesNotMatch(html, /id="api-base"/);
  assert.equal(app.intervals.length, 1);
  assert.equal(app.intervals[0].milliseconds, 60000);
  app.intervals[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.fetchRequests.length, 2, 'visible dashboard auto-refreshes');
  assert.match(app.elements.get('status').textContent, /Refreshes automatically every minute/);
});

test('shows status unavailable when the API omits collection_enabled', async () => {
  const app = runDashboard(() => assert.fail('local SDK should avoid a CDN request'), {
    localSdkAvailable: true,
    session: { access_token: 'test-access-token' },
    storedConfig: {
      supabaseUrl: 'https://project.example.supabase.co',
      supabasePublishableKey: 'sb_publishable_test_key',
    },
    report: {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.elements.get('collection-status').dataset.state, 'unknown');
  assert.equal(app.elements.get('collection-status-label').textContent, 'Collection status unavailable');
  assert.match(app.elements.get('status').textContent, /Refreshes automatically every minute/);
});

test('renders friendly names for recorded analytics categories', async () => {
  const app = runDashboard(() => assert.fail('local SDK should avoid a CDN request'), {
    localSdkAvailable: true,
    session: { access_token: 'test-access-token' },
    storedConfig: {
      supabaseUrl: 'https://project.example.supabase.co',
      supabasePublishableKey: 'sb_publishable_test_key',
    },
    report: {
      collection_enabled: true,
      input_sources: { device_image: 3, ordinary_photo: 3, scanner: 3 },
      answer_requests_by_mode: { source_analysis: 3 },
      comparisons: {
        input_path: { counts: { choose_photo: 3, take_photo: 3, scan_document: 3 }, total: 9 },
        plan_tier: { counts: { student: 3 }, total: 3 },
        selected_voice: { counts: { quapture_voice: 3 }, total: 3 },
        entry_route: { counts: { q_lens_home: 3 }, total: 3 },
        sign_in_method: { counts: { google: 3 }, total: 3 },
      },
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.elements.get('sources').innerHTML, /Image uploaded from device/);
  assert.doesNotMatch(app.elements.get('sources').innerHTML, /device_image/);
  assert.match(app.elements.get('modes').innerHTML, /Source analysis/);
  assert.match(app.elements.get('comparison-input').innerHTML, /Choose a photo/);
  assert.match(app.elements.get('comparison-input').innerHTML, /Take a photo/);
  assert.match(app.elements.get('comparison-input').innerHTML, /Scan a document/);
  assert.match(app.elements.get('comparison-route').innerHTML, /Q Lens from Home/);
  assert.match(app.elements.get('comparison-signin').innerHTML, /Google/);
});
