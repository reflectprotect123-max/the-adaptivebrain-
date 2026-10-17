#!/usr/bin/env node
/** The Coach browser client must call the shared Supabase WHOOP routes directly. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const requests = [];
const state = { settings: { whoop: {} } };
const window = {
  location: { hostname: 'localhost', protocol: 'file:' },
  WhoopCommon: {
    clientFactory: () => () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'session-jwt', user: { id: 'user-1' } } } }) } }),
    refreshStatus: async ({ api, route }) => {
      assert.equal(route, 'strength-whoop-status');
      return api(route);
    },
    todayIso: () => '2026-10-17',
  },
  supabase: { createClient: () => ({}) },
  S: state,
  save() {},
  setTimeout,
};
const source = readFileSync(new URL('./whoop.js', import.meta.url), 'utf8');
runInNewContext(source, {
  window,
  URLSearchParams,
  fetch: async (url, options) => {
    requests.push({ url: String(url), options });
    return { ok: true, json: async () => ({ whoop: { connected: false } }) };
  },
});
await window.Whoop.refreshStatus();
assert.equal(requests.length, 1);
assert.equal(requests[0].url, 'https://orysjncrksmdfabpuftd.supabase.co/functions/v1/strength-whoop-status?product=engine');
assert.equal(requests[0].options.headers.authorization, 'Bearer session-jwt');
assert.ok(requests[0].options.headers.apikey.length > 20, 'public Supabase key is attached');
assert.equal(requests[0].options.headers['x-hybrid-product'], 'engine');
assert.equal(requests[0].options.cache, 'no-store');
console.log('coach-whoop-supabase.smoke: ok');
