import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneratedComment } from '../types';

function PopupApp() {
  const [enabled, setEnabled] = useState(true);
  const [lastComment, setLastComment] = useState<GeneratedComment | null>(null);
  const [copied, setCopied] = useState<1 | 2 | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    chrome.storage.local.get('lca_data', (result) => {
      const data = result['lca_data'];
      if (data?.settings?.enabled === false) setEnabled(false);
      const recent: GeneratedComment[] = data?.comments ?? [];
      if (recent.length > 0) setLastComment(recent[0]);
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

  function copyComment(text: string, which: 1 | 2) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  function syncToDashboard() {
    setIsSyncing(true);
    chrome.runtime.sendMessage({ type: 'SYNC_TO_DASHBOARD' }, () => {
      setIsSyncing(false);
      showFlash('Synced!');
    });
  }

  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  return (
    <div style={{
      width: 340,
      padding: '14px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '13px',
      color: '#1d2226',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ ...row, marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '18px' }}>✨</span>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>AI Comment Assistant</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleEnabled}
            style={{ accentColor: '#0077b5', width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: enabled ? '#0077b5' : '#999', fontWeight: 600 }}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
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
            <div key={which} style={{
              background: '#f3f6f8',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '8px',
              border: '1px solid #e0e7ed',
            }}>
              <p style={{
                margin: '0 0 8px',
                fontSize: '12px',
                lineHeight: '1.5',
                color: '#1d2226',
              }}>
                {text}
              </p>
              <button
                onClick={() => copyComment(text, which)}
                style={{
                  padding: '4px 12px',
                  background: copied === which ? '#22c55e' : '#0077b5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                {copied === which ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: '#f3f6f8',
          borderRadius: '10px',
          padding: '22px 16px',
          textAlign: 'center',
          marginBottom: '8px',
          border: '1px dashed #c8d8e4',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '22px' }}>✨</p>
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#333', fontSize: '13px' }}>
            No comments yet
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
            Click the <strong>✨ AI</strong> button next to<br />
            any LinkedIn comment box to generate.
          </p>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: '#e0e0e0', margin: '12px 0' }} />

      {/* Sync button */}
      <button
        onClick={syncToDashboard}
        disabled={isSyncing}
        style={{
          width: '100%',
          padding: '8px',
          background: isSyncing ? '#b0c4cf' : '#0077b5',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          transition: 'background 0.2s',
        }}
      >
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

const root = createRoot(document.getElementById('popup-root')!);
root.render(<PopupApp />);
