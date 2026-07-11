import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneratedComment, AuthSession } from '../types';
import { generateCommentsFromUrl, GenerateFromUrlResult, AuthRequiredError } from '../services/backend-service';
import { getSession, login, signup, logout } from '../services/auth-service';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const BRAND = '#0077b5';

const shell: React.CSSProperties = {
  width: 340,
  padding: '14px 16px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: '13px',
  color: '#1d2226',
  boxSizing: 'border-box',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: '8px',
  border: '1px solid #c8d0d9',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '9px',
  background: disabled ? '#b0c4cf' : BRAND,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '13px',
  fontWeight: 600,
});

// ---------------------------------------------------------------------------
// Auth screen (login / signup)
// ---------------------------------------------------------------------------
function AuthScreen({ onAuthed }: { onAuthed: (s: AuthSession) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const session = await login(email.trim(), password);
        onAuthed(session);
      } else {
        const session = await signup(email.trim(), password);
        onAuthed(session);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
        <span style={{ fontSize: '18px' }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>AI Comment Assistant</span>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#666' }}>
        {mode === 'login' ? 'Log in to continue.' : 'Create an account to get started.'}
      </p>

      <form onSubmit={submit}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          style={{ ...inputStyle, marginBottom: '10px' }}
        />

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          style={{ ...inputStyle, marginBottom: '12px' }}
        />

        {error && (
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#d33', lineHeight: 1.4 }}>{error}</p>
        )}

        <button type="submit" disabled={busy} style={primaryBtn(busy)}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#666', textAlign: 'center' }}>
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
          style={{ background: 'none', border: 'none', color: BRAND, fontWeight: 600, cursor: 'pointer', fontSize: '12px', padding: 0 }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app (authenticated)
// ---------------------------------------------------------------------------
function MainApp({ session, onLoggedOut }: { session: AuthSession; onLoggedOut: () => void }) {
  const [enabled, setEnabled] = useState(true);
  const [lastComment, setLastComment] = useState<GeneratedComment | null>(null);
  const [copied, setCopied] = useState<1 | 2 | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [flash, setFlash] = useState('');

  const [postUrl, setPostUrl] = useState('');
  const [urlGenState, setUrlGenState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [urlGenError, setUrlGenError] = useState('');
  const [urlResult, setUrlResult] = useState<GenerateFromUrlResult | null>(null);
  const [urlCopied, setUrlCopied] = useState<1 | 2 | null>(null);

  useEffect(() => {
    chrome.storage.local.get('lca_data', (result) => {
      const data = result['lca_data'];
      if (data?.settings?.enabled === false) setEnabled(false);
      const recent: GeneratedComment[] = data?.comments ?? [];
      if (recent.length > 0) setLastComment(recent[0]);
    });

    chrome.storage.local.get('lca_url_gen_state', (result) => {
      const saved = result['lca_url_gen_state'];
      if (saved?.postUrl) setPostUrl(saved.postUrl);
      if (saved?.result) setUrlResult(saved.result);
    });
  }, []);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2000);
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.get('lca_data', (result) => {
      const data = result['lca_data'] ?? {};
      data.settings = data.settings ?? {};
      data.settings.enabled = next;
      chrome.storage.local.set({ lca_data: data });
    });
    showFlash(next ? 'Extension enabled' : 'Extension disabled');
  }

  function copyToClipboard(text: string, setter: (w: 1 | 2 | null) => void, which: 1 | 2) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setter(which);
    setTimeout(() => setter(null), 2000);
  }

  async function handleGenerateFromUrl() {
    if (!postUrl.trim()) return;
    setUrlGenState('loading');
    setUrlGenError('');
    setUrlResult(null);
    try {
      const trimmedUrl = postUrl.trim();
      const result = await generateCommentsFromUrl(trimmedUrl);
      setUrlResult(result);
      setUrlGenState('idle');
      chrome.storage.local.set({ lca_url_gen_state: { postUrl: trimmedUrl, result } });
    } catch (err: any) {
      if (err instanceof AuthRequiredError) {
        // Session died — bounce back to the login screen.
        await logout();
        onLoggedOut();
        return;
      }
      setUrlGenError(err?.message ?? 'Something went wrong. Is the backend running?');
      setUrlGenState('error');
    }
  }

  function handleResetUrlGen() {
    setPostUrl('');
    setUrlResult(null);
    setUrlGenState('idle');
    setUrlGenError('');
    chrome.storage.local.remove('lca_url_gen_state');
  }

  function syncToDashboard() {
    setIsSyncing(true);
    chrome.runtime.sendMessage({ type: 'SYNC_TO_DASHBOARD' }, () => {
      setIsSyncing(false);
      showFlash('Synced!');
    });
  }

  async function handleLogout() {
    await logout();
    onLoggedOut();
  }

  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  return (
    <div style={shell}>
      {/* Header */}
      <div style={{ ...row, marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '18px' }}>✨</span>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>AI Comment Assistant</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleEnabled}
            style={{ accentColor: BRAND, width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: enabled ? BRAND : '#999', fontWeight: 600 }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* Account row */}
      <div style={{ ...row, marginBottom: '12px', fontSize: '11px', color: '#666' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
          {session.user.email ?? 'Signed in'}
        </span>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: BRAND, fontWeight: 600, cursor: 'pointer', fontSize: '11px', padding: 0 }}
        >
          Log out
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e0e0e0', marginBottom: '14px' }} />

      {/* Generate from URL */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Generate From Post URL
        </p>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            type="text"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="Paste a LinkedIn post URL..."
            style={{ ...inputStyle, flex: 1, padding: '7px 10px', fontSize: '12px' }}
          />
          <button
            onClick={handleGenerateFromUrl}
            disabled={urlGenState === 'loading' || !postUrl.trim()}
            style={{
              padding: '7px 14px',
              background: urlGenState === 'loading' ? '#b0c4cf' : BRAND,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: urlGenState === 'loading' || !postUrl.trim() ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {urlGenState === 'loading' ? 'Working...' : 'Generate'}
          </button>
          {(urlResult || postUrl.trim()) && (
            <button
              onClick={handleResetUrlGen}
              disabled={urlGenState === 'loading'}
              title="Clear the URL and generated comments"
              style={{
                padding: '7px 12px',
                background: 'transparent',
                color: '#666',
                border: '1px solid #c8d0d9',
                borderRadius: '8px',
                cursor: urlGenState === 'loading' ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Reset
            </button>
          )}
        </div>

        {urlGenState === 'error' && (
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#d33', lineHeight: 1.4 }}>
            {urlGenError}
          </p>
        )}

        {urlResult && (
          <div>
            {([
              { text: urlResult.comment1, which: 1 as const },
              { text: urlResult.comment2, which: 2 as const },
            ]).map(({ text, which }) => (
              <div key={which} style={{ background: '#f3f6f8', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', border: '1px solid #e0e7ed' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', lineHeight: '1.5', color: '#1d2226' }}>{text}</p>
                <button
                  onClick={() => copyToClipboard(text, setUrlCopied, which)}
                  style={{ padding: '4px 12px', background: urlCopied === which ? '#22c55e' : BRAND, color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'background 0.2s' }}
                >
                  {urlCopied === which ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e0e0e0', marginBottom: '14px' }} />

      {/* Comment boxes */}
      {lastComment ? (
        <div>
          <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Last Generated Comments
          </p>
          {([
            { text: lastComment.comment1, which: 1 as const },
            { text: lastComment.comment2, which: 2 as const },
          ]).map(({ text, which }) => (
            <div key={which} style={{ background: '#f3f6f8', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', border: '1px solid #e0e7ed' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', lineHeight: '1.5', color: '#1d2226' }}>{text}</p>
              <button
                onClick={() => copyToClipboard(text, setCopied, which)}
                style={{ padding: '4px 12px', background: copied === which ? '#22c55e' : BRAND, color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'background 0.2s' }}
              >
                {copied === which ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: '#f3f6f8', borderRadius: '10px', padding: '22px 16px', textAlign: 'center', marginBottom: '8px', border: '1px dashed #c8d8e4' }}>
          <p style={{ margin: '0 0 4px', fontSize: '22px' }}>✨</p>
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#333', fontSize: '13px' }}>No comments yet</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
            Click the <strong>✨ AI</strong> button next to<br />
            any LinkedIn comment box to generate.
          </p>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: '#e0e0e0', margin: '12px 0' }} />

      {/* Sync button */}
      <button onClick={syncToDashboard} disabled={isSyncing} style={primaryBtn(isSyncing)}>
        {isSyncing ? 'Syncing...' : 'Sync to Dashboard'}
      </button>

      {flash && (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#22c55e', textAlign: 'center', fontWeight: 600 }}>
          {flash}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root — decides auth vs main
// ---------------------------------------------------------------------------
function PopupApp() {
  const [status, setStatus] = useState<'loading' | 'guest' | 'authed'>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    getSession().then((s) => {
      if (s) {
        setSession(s);
        setStatus('authed');
      } else {
        setStatus('guest');
      }
    });
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ ...shell, textAlign: 'center', color: '#888' }}>
        <p style={{ margin: '20px 0', fontSize: '13px' }}>Loading…</p>
      </div>
    );
  }

  if (status === 'authed' && session) {
    return (
      <MainApp
        session={session}
        onLoggedOut={() => {
          setSession(null);
          setStatus('guest');
        }}
      />
    );
  }

  return (
    <AuthScreen
      onAuthed={(s) => {
        setSession(s);
        setStatus('authed');
      }}
    />
  );
}

const root = createRoot(document.getElementById('popup-root')!);
root.render(<PopupApp />);
