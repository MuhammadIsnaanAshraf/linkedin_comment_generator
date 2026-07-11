import { AuthSession } from '../types';
import { BACKEND_URL } from './config';

/**
 * Client-side auth for the extension.
 *
 * Security model: the extension NEVER holds any Supabase key. It only exchanges
 * email/password for tokens issued by the backend (which talks to Supabase),
 * and stores those tokens in chrome.storage.local — isolated per-extension and
 * not readable by web pages. Every protected backend call carries the access
 * token as a Bearer header; expired tokens are refreshed transparently.
 */

const AUTH_KEY = 'lca_auth';
// Refresh a bit before the token actually expires to avoid edge-of-expiry 401s.
const EXPIRY_SKEW_SECONDS = 60;

interface AuthResponse {
  user: AuthSession['user'];
  session: { access_token: string; refresh_token: string; expires_at: number } | null;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function readStoredSession(): Promise<AuthSession | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(AUTH_KEY, (result) => resolve(result[AUTH_KEY] ?? null));
  });
}

async function writeStoredSession(session: AuthSession | null): Promise<void> {
  return new Promise((resolve) => {
    if (session) {
      chrome.storage.local.set({ [AUTH_KEY]: session }, () => resolve());
    } else {
      chrome.storage.local.remove(AUTH_KEY, () => resolve());
    }
  });
}

function toSession(data: AuthResponse): AuthSession | null {
  if (!data.session) return null;
  return {
    user: data.user,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  };
}

async function postJson(path: string, body: unknown, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    /* body may be empty */
  }

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status}).`);
  }
  return data;
}

// --- Public API ------------------------------------------------------------

/** Sign up and persist the returned session (email confirmation is disabled
 *  in Supabase, so signup always returns a session immediately). */
export async function signup(email: string, password: string): Promise<AuthSession> {
  const data: AuthResponse = await postJson('/api/auth/signup', { email, password });
  const session = toSession(data);
  if (!session) throw new Error('Signup did not return a session.');
  await writeStoredSession(session);
  return session;
}

/** Log in with email/password and persist the session. */
export async function login(email: string, password: string): Promise<AuthSession> {
  const data: AuthResponse = await postJson('/api/auth/login', { email, password });
  const session = toSession(data);
  if (!session) throw new Error('Login did not return a session.');
  await writeStoredSession(session);
  return session;
}

/** Clear local tokens and best-effort revoke the session server-side. */
export async function logout(): Promise<void> {
  const session = await readStoredSession();
  if (session?.access_token) {
    try {
      await postJson('/api/auth/logout', {}, session.access_token);
    } catch {
      // Ignore — we clear local state regardless.
    }
  }
  await writeStoredSession(null);
}

/** The current stored session (may hold an expired access token). */
export async function getSession(): Promise<AuthSession | null> {
  return readStoredSession();
}

/** True if a session exists locally. Used for UI gating; the backend still
 *  verifies the token on every protected call. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await readStoredSession();
  return Boolean(session?.refresh_token);
}

/**
 * Returns a valid access token, refreshing via the backend if the stored one
 * is expired (or about to). Throws if there is no session or refresh fails —
 * callers should treat that as "logged out".
 */
export async function getAccessToken(): Promise<string> {
  const session = await readStoredSession();
  if (!session) throw new Error('Not authenticated. Please log in.');

  if (session.expires_at - EXPIRY_SKEW_SECONDS > nowSeconds()) {
    return session.access_token;
  }

  // Expired — refresh.
  try {
    const data: AuthResponse = await postJson('/api/auth/refresh', {
      refresh_token: session.refresh_token,
    });
    const refreshed = toSession(data);
    if (!refreshed) throw new Error('Refresh returned no session.');
    await writeStoredSession(refreshed);
    return refreshed.access_token;
  } catch (err) {
    await writeStoredSession(null);
    throw new Error('Session expired. Please log in again.');
  }
}

/** Force-refresh after a 401 even if we thought the token was still valid. */
export async function refreshOrClear(): Promise<string | null> {
  const session = await readStoredSession();
  if (!session?.refresh_token) return null;
  try {
    const data: AuthResponse = await postJson('/api/auth/refresh', {
      refresh_token: session.refresh_token,
    });
    const refreshed = toSession(data);
    if (!refreshed) throw new Error('no session');
    await writeStoredSession(refreshed);
    return refreshed.access_token;
  } catch {
    await writeStoredSession(null);
    return null;
  }
}
