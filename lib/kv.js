// lib/kv.js — Vercel KV (Upstash Redis) helper
// Uses native fetch (Node 24) + Upstash REST API.
// Env vars are auto-created when you add a KV store in the Vercel dashboard:
//   KV_REST_API_URL, KV_REST_API_TOKEN

async function kvRun(command, ...args) {
  // Supports both Vercel KV naming and direct Upstash naming
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('KV not configured (KV_REST_API_URL / UPSTASH_REDIS_REST_URL missing)');

  // Use Upstash pipeline format: POST /pipeline with body [[COMMAND, arg1, arg2, ...]]
  // The simple POST /{command} with body [args] format does NOT work — Upstash treats
  // the body as a single literal argument, causing "wrong number of arguments" errors.
  const res = await fetch(`${url}/pipeline`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify([[command.toUpperCase(), ...args]]),
  });
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) throw new Error(`KV ${command} unexpected response`);
  const result = data[0];
  if (result.error) throw new Error(`KV ${command} error: ${result.error}`);
  return result.result;
}

module.exports = {
  /** Get a string value. Returns null if not found. */
  async get(key) {
    return kvRun('GET', key);
  },

  /** Set a string value. Optional TTL in seconds. */
  async set(key, value, ttlSeconds) {
    if (ttlSeconds) return kvRun('SET', key, value, 'EX', ttlSeconds);
    return kvRun('SET', key, value);
  },

  /** Delete a key. */
  async del(key) {
    return kvRun('DEL', key);
  },

  /** Push values to the left of a list. Returns new length. */
  async lpush(key, ...values) {
    return kvRun('LPUSH', key, ...values);
  },

  /** Get a range from a list. Use (key, 0, -1) for all. */
  async lrange(key, start, stop) {
    return kvRun('LRANGE', key, start, stop);
  },

  /** Check if a key exists. */
  async exists(key) {
    const r = await kvRun('EXISTS', key);
    return r === 1;
  },

  /** Get value and JSON.parse it. Returns null if not found or parse fails. */
  async getJson(key) {
    const val = await kvRun('GET', key);
    if (val === null || val === undefined) return null;
    try { return JSON.parse(val); } catch { return null; }
  },

  /** JSON.stringify value and set it. Optional TTL in seconds. */
  async setJson(key, obj, ttlSeconds) {
    const val = JSON.stringify(obj);
    if (ttlSeconds) return kvRun('SET', key, val, 'EX', ttlSeconds);
    return kvRun('SET', key, val);
  },
};
