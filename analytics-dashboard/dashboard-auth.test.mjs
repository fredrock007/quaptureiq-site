import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const pageScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('supabaseLibrarySources'));

assert.ok(pageScript, 'dashboard inline script exists');

function runDashboard(loadBehavior) {
  const elements = new Map();
  const requestedScripts = [];
  const oauthCalls = [];
  const makeElement = () => ({
    value: '',
    hidden: false,
    disabled: false,
    className: '',
    textContent: '',
    innerHTML: '',
    handlers: {},
    addEventListener(eventName, handler) { this.handlers[eventName] = handler; },
  });
  const document = {
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
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    setTimeout,
    clearTimeout,
  };
  context.window = context;
  context.supabase = undefined;

  const client = {
    auth: {
      onAuthStateChange() {},
      async getSession() { return { data: { session: null } }; },
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
  vm.createContext(context);
  vm.runInContext(pageScript, context, { timeout: 1000 });
  elements.get('supabase-url').value = 'https://project.example.supabase.co';
  elements.get('supabase-key').value = 'sb_publishable_test_key';
  return { context, elements, oauthCalls, requestedScripts };
}

test('loads the pinned Supabase browser client from the primary CDN and starts Google OAuth', async () => {
  const app = runDashboard(({ script, context }) => {
    context.supabase = context.testSdk;
    script.onload();
  });

  await app.elements.get('auth-form').handlers.submit({ preventDefault() {} });

  assert.deepEqual(app.requestedScripts, [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2',
  ]);
  assert.equal(app.oauthCalls.length, 1);
  assert.equal(app.oauthCalls[0].provider, 'google');
  assert.equal(
    app.oauthCalls[0].options.redirectTo,
    'https://fredrock007.github.io/quaptureiq-site/analytics-dashboard/',
  );
  assert.match(app.elements.get('auth-status').textContent, /Redirecting to Google/);
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
