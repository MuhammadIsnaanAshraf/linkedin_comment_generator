type PostProcessor = (postEl: Element) => void;

const processedPosts = new WeakSet<Element>();
let processor: PostProcessor | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let observer: MutationObserver | null = null;

const POST_SELECTORS = [
  '.scaffold-finite-scroll__content [data-id]',
  'div.feed-shared-update-v2',
  'li.occludable-update',
];

function findPostElements(): Element[] {
  const found = new Set<Element>();
  for (const selector of POST_SELECTORS) {
    const matches = document.querySelectorAll(selector);
    console.debug('[LCA] selector', JSON.stringify(selector), 'matched', matches.length, 'elements');
    matches.forEach((el) => found.add(el));
  }
  return Array.from(found);
}

function scanAndProcess(): void {
  if (!processor) return;
  const posts = findPostElements();
  for (const post of posts) {
    if (!processedPosts.has(post)) {
      processedPosts.add(post);
      try {
        processor(post);
      } catch (err) {
        console.warn('[LCA] Error processing post:', err);
      }
    }
  }
}

function debouncedScan(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanAndProcess, 500);
}

function startObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(debouncedScan);
  observer.observe(document.body, { childList: true, subtree: true });
  scanAndProcess();
}

function patchHistoryPushState(): void {
  const original = history.pushState.bind(history);
  history.pushState = function (...args) {
    original(...args);
    setTimeout(startObserver, 1000);
  };
}

export function initObserver(postProcessor: PostProcessor): void {
  processor = postProcessor;
  startObserver();

  window.addEventListener('popstate', () => {
    setTimeout(startObserver, 1000);
  });

  patchHistoryPushState();
}

export function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
