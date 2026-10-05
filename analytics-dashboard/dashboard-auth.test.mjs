import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const productionConfigSource = await readFile(new URL('./config.production.js', import.meta.url), 'utf8');
const pageScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('supabaseLibrarySources'));

assert.ok(pageScript, 'dashboard inline script exists');

function runDashboard(loadBehavior, {
  localSdkAvailable = false,
  session = null,
  report = {},
  storedConfig = null,
  productionConfigLoaded = true,
  configuredApiBaseUrl = 'https://quaptureiq-api.duckdns.org',
} = {}) {
  const elements = new Map();
  const requestedScripts = [];
  const oauthCalls = [];
  const fetchRequests = [];
  const intervals = [];
  const toastTimers = [];
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
    URL,
    location: {
      href: 'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/',
      origin: 'https://fredrock007.github.io',
    },
    QAPTURE_ANALYTICS_CONFIG: { apiBaseUrl: configuredApiBaseUrl },
    QAPTURE_ANALYTICS_PRODUCTION_API_CONFIG_LOADED: productionConfigLoaded,
    localStorage: {
      getItem(key) {
        return key === 'qaptureiq-analytics-public-config' && storedConfig
          ? JSON.stringify(storedConfig) : null;
      },
      setItem() {},
      removeItem() {},
    },
    setTimeout(callback, milliseconds) {
      const timer = { callback, milliseconds, cleared: false };
      toastTimers.push(timer);
      return toastTimers.length;
    },
    clearTimeout(id) {
      if (toastTimers[id - 1]) toastTimers[id - 1].cleared = true;
    },
    setInterval(callback, milliseconds) {
      const interval = { callback, milliseconds, cleared: false };
      intervals.push(interval);
      return intervals.length;
    },
    clearInterval(id) {
      if (intervals[id - 1]) intervals[id - 1].cleared = true;
    },
    async fetch(url, options) {
      const requestUrl = new URL(url);
      assert.equal(requestUrl.origin, 'https://quaptureiq-api.duckdns.org');
      assert.equal(requestUrl.pathname, '/analytics/report');
      assert.ok(Number.isFinite(Date.parse(requestUrl.searchParams.get('since'))));
      assert.ok(Number.isFinite(Date.parse(requestUrl.searchParams.get('until'))));
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
      async signOut(options) {
        client.signOutOptions = options;
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
  return { context, elements, oauthCalls, requestedScripts, fetchRequests, intervals, toastTimers, client };
}

test('production API overlay is origin-scoped and preserves existing public Supabase settings', () => {
  const production = {
    location: { origin: 'https://fredrock007.github.io' },
    QAPTURE_ANALYTICS_CONFIG: {
      supabaseUrl: 'https://project.example.supabase.co',
      supabasePublishableKey: 'sb_publishable_test_key',
      redirectTo: 'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/',
    },
  };
  production.window = production;
  vm.createContext(production);
  vm.runInContext(productionConfigSource, production, { timeout: 1000 });
  assert.equal(production.QAPTURE_ANALYTICS_CONFIG.apiBaseUrl, 'https://quaptureiq-api.duckdns.org');
  assert.equal(production.QAPTURE_ANALYTICS_CONFIG.supabaseUrl, 'https://project.example.supabase.co');
  assert.equal(production.QAPTURE_ANALYTICS_CONFIG.supabasePublishableKey, 'sb_publishable_test_key');
  assert.equal(production.QAPTURE_ANALYTICS_CONFIG.redirectTo, 'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/');
  assert.equal(production.QAPTURE_ANALYTICS_PRODUCTION_API_CONFIG_LOADED, true);

  const qa = {
    location: { origin: 'http://127.0.0.1:4177' },
    QAPTURE_ANALYTICS_CONFIG: { apiBaseUrl: 'http://127.0.0.1:18080' },
  };
  qa.window = qa;
  vm.createContext(qa);
  vm.runInContext(productionConfigSource, qa, { timeout: 1000 });
  assert.equal(qa.QAPTURE_ANALYTICS_CONFIG.apiBaseUrl, 'http://127.0.0.1:18080');
  assert.equal(qa.QAPTURE_ANALYTICS_PRODUCTION_API_CONFIG_LOADED, undefined);
});

test('does not issue report requests when production API configuration is missing or invalid', async () => {
  for (const settings of [
    { productionConfigLoaded: false, configuredApiBaseUrl: 'https://quaptureiq-api.duckdns.org' },
    { productionConfigLoaded: true, configuredApiBaseUrl: 'http://quaptureiq-api.duckdns.org' },
    { productionConfigLoaded: true, configuredApiBaseUrl: 'https://84.12.79.38' },
  ]) {
    const app = runDashboard(() => assert.fail('local SDK should avoid a CDN request'), {
      localSdkAvailable: true,
      session: { access_token: 'test-access-token' },
      storedConfig: {
        supabaseUrl: 'https://project.example.supabase.co',
        supabasePublishableKey: 'sb_publishable_test_key',
      },
      ...settings,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.fetchRequests.length, 0);
    assert.match(app.elements.get('status').textContent, /API configuration is missing or not permitted/);
  }
});

test('uses the locally vendored pinned Supabase client and starts Google OAuth', async () => {
  assert.match(html, /<script src="\.\/vendor\/supabase-js-2\.117\.2\.js" integrity="sha384-[^"]+" crossorigin="anonymous"><\/script>/);
  assert.match(html, /id="toast" class="toast" role="status" aria-live="polite"/);
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
  assert.equal(app.elements.get('toast').textContent, 'Google sign-in is starting…');
  assert.equal(app.elements.get('toast').dataset.kind, 'success');
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
  assert.equal(app.elements.get('toast').dataset.kind, 'error');
  assert.match(app.elements.get('toast').textContent, /Google sign-in is temporarily unavailable/);
});


test('restores the saved Google session, auto-loads metrics, and refreshes automatically', async () => {
  const app = runDashboard(() => assert.fail('local SDK should avoid a CDN request'), {
    localSdkAvailable: true,
    session: { access_token: 'test-access-token' },
    storedConfig: {
      supabaseUrl: 'https://project.example.supabase.co',
      supabasePublishableKey: 'sb_publishable_test_key',
    },
    report: { collection_enabled: true, active_app_sessions: 1 },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.fetchRequests.length, 1, 'saved session loads metrics without another click');
  assert.equal(app.elements.get('collection-status').dataset.state, 'enabled');
  assert.equal(app.elements.get('collection-status-label').textContent, 'Analytics collection enabled');
  assert.equal(app.elements.get('active-devices').textContent, '1');
  assert.doesNotMatch(html, /id="api-base"/);
  assert.equal(app.intervals.length, 1);
  assert.equal(app.intervals[0].milliseconds, 60000);
  app.intervals[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.fetchRequests.length, 2, 'visible dashboard auto-refreshes');
  assert.match(app.elements.get('status').textContent, /Refreshes automatically every minute/);

  await app.elements.get('refresh-now').handlers.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.fetchRequests.length, 3, 'manual refresh loads the report');
  assert.equal(app.elements.get('toast').textContent, 'Dashboard refreshed.');
  assert.equal(app.elements.get('toast').dataset.kind, 'success');

  await app.elements.get('sign-out').handlers.click();
  assert.equal(app.client.signOutOptions.scope, 'local');
  assert.equal(app.elements.get('toast').textContent, 'Signed out of the dashboard. The mobile app remains signed in.');
  assert.equal(app.elements.get('toast').dataset.kind, 'success');
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
