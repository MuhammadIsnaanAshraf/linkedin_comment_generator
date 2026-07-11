import './ui/styles.css';
import { initObserver } from './linkedin-observer';
import { extractPost } from './post-extractor';
import { injectCommentButton } from './ui/CommentButton';

const MAX_RETRIES = 8;
const RETRY_MS = 400;

const POST_ANCESTOR_SELECTORS = [
  '.feed-shared-update-v2',
  '.occludable-update',
  '[data-id]',
];

function findPostAncestor(el: Element): Element | null {
  for (const sel of POST_ANCESTOR_SELECTORS) {
    const found = el.closest(sel);
    if (found) return found;
  }
  return null;
}

const IDENTITY_MODULE_SELECTOR = '[componentkey="feedIdentityModuleComponentRef"]';

// LinkedIn places the comment box OUTSIDE the [data-id] post element (as a sibling).
// This walks up from the comment box and finds the post element in a sibling branch.
function findNearestPost(el: Element): Element | null {
  const ancestor = findPostAncestor(el);
  if (ancestor) return ancestor;

  let container = el.parentElement;
  for (let depth = 0; depth < 8; depth++) {
    if (!container) break;
    for (const sel of POST_ANCESTOR_SELECTORS) {
      const found = container.querySelector(sel);
      if (found && !found.contains(el)) return found;
    }
    container = container.parentElement;
  }

  // LinkedIn's redesign dropped stable classes but kept a semantic
  // componentkey on the per-post author/headline block. Walk up from the
  // comment box until an ancestor's subtree contains that block — that
  // ancestor is the actual post wrapper (header + body + comment box).
  let identityContainer: Element | null = el;
  for (let depth = 0; depth < 30; depth++) {
    if (!identityContainer) {
      console.warn('[LCA] findNearestPost: ran out of ancestors at depth', depth);
      break;
    }
    if (identityContainer.querySelector(IDENTITY_MODULE_SELECTOR)) {
      console.debug('[LCA] findNearestPost: identity module found at depth', depth, identityContainer);
      return identityContainer;
    }
    identityContainer = identityContainer.parentElement;
  }
  console.warn('[LCA] findNearestPost: identity module never found within 30 levels, starting from', el);

  return null;
}

function processPost(postEl: Element): void {
  const post = extractPost(postEl);
  if (!post) {
    console.warn('[LCA] extractPost returned null for', postEl);
    return;
  }
  console.debug('[LCA] processPost extracted:', { author: post.authorName, textLen: post.postText.length });

  let attempts = 0;

  function tryInject(): void {
    if (postEl.querySelector('[data-lca-injected]')) return;
    const injected = injectCommentButton(postEl, post!);
    if (!injected && attempts < MAX_RETRIES) {
      attempts++;
      setTimeout(tryInject, RETRY_MS);
    } else if (!injected) {
      console.warn('[LCA] processPost: gave up injecting button after', MAX_RETRIES, 'attempts on', postEl);
    }
  }

  tryInject();
}

// Triggered when the user clicks "Comment" on a LinkedIn post.
// The comment box (including its ql-editor) appears in the DOM at that moment —
// possibly OUTSIDE the post [data-id] element (a sibling in LinkedIn's layout).
function watchCommentBoxes(): void {
  const EDITOR_SELECTORS = '[role="textbox"], div.mentions-text, .ql-editor';

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        const editors: Element[] = node.matches(EDITOR_SELECTORS)
          ? [node]
          : Array.from(node.querySelectorAll(EDITOR_SELECTORS));

        for (const editor of editors) {
         try {
          console.debug('[LCA] watchCommentBoxes: editor detected', editor.className, editor.outerHTML.slice(0, 200));

          // LinkedIn's comment box now uses hashed/atomic CSS classes with no stable
          // names, so class-based lookups are unreliable. Prefer a semantic <form>
          // ancestor (comment boxes are forms), falling back to a fixed number of
          // parent levels above the editor so we always land on *some* container.
          const commentBox: Element | null =
            editor.closest('.comments-comment-box') ??
            (editor.closest('.comments-comment-texteditor')?.parentElement ?? null) ??
            editor.closest('form') ??
            editor.parentElement?.parentElement?.parentElement ??
            editor.parentElement ??
            null;

          if (!commentBox) {
            console.warn('[LCA] watchCommentBoxes: no ancestor container found for editor', editor);
            continue;
          }
          if (commentBox.querySelector('[data-lca-injected]')) {
            console.debug('[LCA] watchCommentBoxes: commentBox already has injected marker, skipping', commentBox);
            continue;
          }

          // Find the post element for AI content (may be a sibling, not ancestor)
          const postDataEl = findNearestPost(commentBox);
          if (!postDataEl) {
            console.warn('[LCA] watchCommentBoxes: findNearestPost failed for commentBox', commentBox);
          } else {
            console.debug('[LCA] watchCommentBoxes: postDataEl found', postDataEl.tagName, postDataEl.className);
          }

          // Capture as const so the closure has the narrowed type
          const box = commentBox;

          setTimeout(() => {
           try {
            if (box.querySelector('[data-lca-injected]')) return;

            // Fall back to extracting from the comment box itself when no
            // dedicated post ancestor was found — extractPost never returns
            // null except on exception, so this still gets us *a* button.
            const post = extractPost(postDataEl ?? box);
            if (!post) {
              console.warn('[LCA] watchCommentBoxes: extractPost returned null for postDataEl', postDataEl);
              return;
            }
            console.debug('[LCA] watchCommentBoxes: post extracted, attempting injection', { author: post.authorName, textLen: post.postText.length });

            let attempts = 0;
            function tryInject(): void {
              if (box.querySelector('[data-lca-injected]')) return;
              // Search for controls inside the comment box (not the full post element)
              // Pass the comment box as postEl so text insertion works (editor is inside it)
              const done = injectCommentButton(box, post!, box);
              if (!done && attempts++ < MAX_RETRIES) {
                setTimeout(tryInject, RETRY_MS);
              } else if (!done) {
                console.warn('[LCA] watchCommentBoxes: gave up injecting after', MAX_RETRIES, 'attempts on', box);
              }
            }
            tryInject();
           } catch (err) {
             console.error('[LCA] watchCommentBoxes: exception in setTimeout callback', err);
           }
          }, 300);
         } catch (err) {
           console.error('[LCA] watchCommentBoxes: exception in editor loop', err);
         }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

let started = false;

// Only inject the ✨ button once the user is logged in AND the extension is
// enabled. Auth is checked by the presence of a stored session; the backend
// still verifies the token on any request it receives.
function maybeStart(): void {
  if (started) return;
  chrome.storage.local.get(['lca_data', 'lca_auth'], (result) => {
    if (started) return;
    const loggedIn = Boolean(result['lca_auth']?.refresh_token);
    if (!loggedIn) return;
    const settings = result['lca_data']?.settings;
    if (settings && settings.enabled === false) return;
    started = true;
    initObserver(processPost);
    watchCommentBoxes();
  });
}

function init(): void {
  if (typeof chrome === 'undefined' || !chrome.storage) return;

  maybeStart();

  // If the user logs in (from the popup) while this tab is already open, start
  // injecting without requiring a manual reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['lca_auth']) maybeStart();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
