import React, { useState, useRef, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ExtractedPost } from '../../types';
import { extractPost } from '../post-extractor';
import { CommentPanel } from './CommentPanel';

interface Props {
  postEl: Element;      // Comment box element (for text insertion)
  post: ExtractedPost;  // Pre-extracted post data (for AI generation)
}

function CommentButtonInner({ postEl, post }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRootRef = useRef<Root | null>(null);
  const panelContainerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (panelContainerRef.current) {
        panelContainerRef.current.remove();
        panelContainerRef.current = null;
      }
    };
  }, []);

  function openPanel() {
    if (isOpen) { closePanel(); return; }
    setIsOpen(true);

    if (!panelContainerRef.current) {
      const container = document.createElement('div');
      container.setAttribute('data-lca-panel-root', 'true');
      document.body.appendChild(container);
      panelContainerRef.current = container;
    }

    if (buttonRef.current && panelContainerRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left - 8, window.innerWidth - 356));
      panelContainerRef.current.style.cssText = `
        position: fixed;
        z-index: 99999;
        left: ${left}px;
        top: ${rect.bottom + 8}px;
        width: 340px;
      `;
    }

    if (!panelRootRef.current) {
      panelRootRef.current = createRoot(panelContainerRef.current!);
    }

    // Re-extract only if we find meaningful post text; otherwise use the prop
    const extracted = extractPost(postEl);
    const freshPost = (extracted?.postText?.length ?? 0) > 0 ? extracted! : post;

    panelRootRef.current.render(
      <CommentPanel post={freshPost} postEl={postEl} onClose={closePanel} />
    );
  }

  function closePanel() {
    setIsOpen(false);
    panelRootRef.current?.render(<></>);
  }

  return (
    <button
      ref={buttonRef}
      onClick={openPanel}
      title="Generate AI comment"
      aria-label="Generate AI comment"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '4px 10px',
        borderRadius: '16px',
        border: `1px solid ${isOpen ? '#0077b5' : '#c8d0d9'}`,
        background: isOpen ? '#e8f4fb' : 'transparent',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
        color: isOpen ? '#0077b5' : '#5a7a94',
        transition: 'all 0.15s ease',
        lineHeight: '1',
        flexShrink: 0,
        marginRight: '4px',
        fontFamily: 'inherit',
        verticalAlign: 'middle',
      }}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }}>✨</span>
      <span>AI</span>
    </button>
  );
}

// Strategy 1: known LinkedIn toolbar class names
const CONTROLS_SELECTORS = [
  '.comments-comment-box__commentor-actions',
  '.comments-comment-box__controls-wrapper',
  '.comments-comment-box__submit-button-wrapper',
  '.editor-toolbar',
  '.comments-comment-box__controls',
];

/**
 * Inject the ✨ AI button into the comment toolbar.
 *
 * @param containerEl  Element to search within for toolbar controls.
 *                     When called from processPost: the full post element.
 *                     When called from watchCommentBoxes: the comment box itself.
 * @param post         Pre-extracted post data for the AI.
 * @param postEl       Element passed to CommentButtonInner for text insertion.
 *                     Defaults to containerEl. Pass the comment box here so
 *                     insertComment can find the <div contenteditable> inside it.
 */
export function injectCommentButton(
  containerEl: Element,
  post: ExtractedPost,
  postEl?: Element
): boolean {
  const targetEl = postEl ?? containerEl;

  if (containerEl.querySelector('[data-lca-injected]')) return true;

  // Strategy 1: known LinkedIn toolbar class names
  for (const selector of CONTROLS_SELECTORS) {
    const el = containerEl.querySelector(selector);
    if (!el) continue;

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-lca-injected', 'true');
    wrapper.style.cssText = 'display:inline-flex;align-items:center;';
    el.insertBefore(wrapper, el.firstChild);
    createRoot(wrapper).render(<CommentButtonInner postEl={targetEl} post={post} />);
    console.debug('[LCA] injectCommentButton: SUCCESS via strategy 1', selector, wrapper);
    return true;
  }

  // Strategy 2: find the "Comment" / "Reply" submit button and insert before it.
  // Works regardless of toolbar wrapper class names — targets the visible button text.
  const allButtons = Array.from(containerEl.querySelectorAll('button'));
  const submitBtn = allButtons.find((btn) => {
    const text = (btn.textContent ?? '').trim();
    const label = (btn.getAttribute('aria-label') ?? '').toLowerCase();
    const cls = btn.className ?? '';
    return (
      text === 'Comment' ||
      text === 'Reply' ||
      label.includes('post comment') ||
      label.includes('add a comment') ||
      cls.includes('submit') ||
      cls.includes('comment-box__submit')
    );
  });
  if (submitBtn?.parentElement) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-lca-injected', 'true');
    wrapper.style.cssText = 'display:inline-flex;align-items:center;margin-right:4px;';
    submitBtn.parentElement.insertBefore(wrapper, submitBtn);
    createRoot(wrapper).render(<CommentButtonInner postEl={targetEl} post={post} />);
    console.debug('[LCA] injectCommentButton: SUCCESS via strategy 2 (submit button)', submitBtn, wrapper);
    return true;
  }

  // Strategy 3: find the editor element and inject after its container.
  const editor =
    containerEl.querySelector('.ql-editor') ??
    containerEl.querySelector('[role="textbox"]') ??
    containerEl.querySelector('[contenteditable="true"]');

  if (!editor) {
    console.warn('[LCA] injectCommentButton: no editor found in container, will retry:', containerEl.outerHTML.slice(0, 300));
    return false; // comment box not in DOM yet — caller will retry
  }

  const editorContainer =
    editor.closest('.comments-comment-texteditor') ??
    editor.closest('.comments-comment-box') ??
    editor.parentElement;

  if (!editorContainer?.parentElement) {
    console.warn('[LCA] injectCommentButton: editor found but no valid parent to inject into', editor);
    return false;
  }

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-lca-injected', 'true');
  wrapper.style.cssText = 'display:inline-flex;align-items:center;padding:4px 8px;';
  editorContainer.parentElement.insertBefore(wrapper, editorContainer.nextSibling);
  createRoot(wrapper).render(<CommentButtonInner postEl={targetEl} post={post} />);
  console.debug('[LCA] injectCommentButton: SUCCESS via strategy 3 (editor fallback)', editorContainer, wrapper);
  return true;
}
