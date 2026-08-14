/**
 * Thin fetch-based client for Supabase's REST (PostgREST) and Auth (GoTrue)
 * APIs. No SDK, no bundler, no CDN dependency — just the two config values
 * from backend-config.js and plain HTTP calls, so the site stays a
 * zero-dependency static app when the backend isn't configured, and adds
 * nothing but `fetch()` calls when it is.
 *
 * Reads (fetchTable) work for every visitor via the public "anon" key and
 * RLS "allow select" policies. Writes (insertRow/updateRow/deleteRow) require
 * a signed-in admin session — RLS on the Supabase side is the real gate;
 * signIn() is just how the browser obtains that session's access token.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './backend-config.js';

const SESSION_KEY = 'isr-site-in-a-box:admin-session:v1';
const REFRESH_SKEW_MS = 60_000; // refresh a bit before actual expiry

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* localStorage unavailable - session just won't survive a reload */
  }
}

async function parseErrorMessage(res) {
  try {
    const body = await res.json();
    return body.error_description || body.msg || body.message || body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function authFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function signIn(email, password) {
  if (!isConfigured()) throw new Error('Backend is not configured.');
  const data = await authFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: data.user?.email ?? email,
  };
  saveSession(session);
  return session;
}

export async function signOut() {
  const session = loadSession();
  saveSession(null);
  if (!session || !isConfigured()) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    /* best-effort - local session is already cleared */
  }
}

/** Returns a valid session (refreshing if near expiry) or null if signed out. */
export async function getSession() {
  if (!isConfigured()) return null;
  const session = loadSession();
  if (!session) return null;
  if (session.expires_at - Date.now() > REFRESH_SKEW_MS) return session;

  try {
    const data = await authFetch('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      email: data.user?.email ?? session.email,
    };
    saveSession(next);
    return next;
  } catch {
    saveSession(null);
    return null;
  }
}

async function restFetch(path, options = {}) {
  const session = await getSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session ? session.access_token : SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Public read - works for every visitor, signed in or not. */
export async function fetchTable(table, { signal } = {}) {
  const session = await getSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=sort_order.asc`, {
    signal,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session ? session.access_token : SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** Admin-only writes - RLS on the Supabase side rejects these without a valid admin session. */
export function insertRow(table, row) {
  return restFetch(`/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
}

export function updateRow(table, id, patch) {
  return restFetch(`/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
}

export function deleteRow(table, id) {
  return restFetch(`/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}
