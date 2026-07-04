// Injected only on localhost dashboard pages

function isContextValid(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'REQUEST_SYNC') {
    if (!isContextValid()) return;
    try {
      chrome.runtime.sendMessage({ type: 'SYNC_TO_DASHBOARD' });
    } catch {
      // Extension context invalidated after reload — ignore
    }
  }
});

try {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SYNC_DATA_PAYLOAD') {
      window.postMessage({ type: 'SYNC_RECEIVED', data: message.payload }, '*');
    }
  });
} catch {
  // Extension context invalidated — ignore
}
