function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findCommentBox(postEl: Element): HTMLElement | null {
  // Try Quill editor (with or without the form wrapper)
  return (
    (postEl.querySelector('.comments-comment-box__form .ql-editor') as HTMLElement | null) ??
    (postEl.querySelector('.ql-editor') as HTMLElement | null) ??
    (postEl.querySelector('[role="textbox"][contenteditable="true"]') as HTMLElement | null) ??
    (postEl.querySelector('[contenteditable="true"]') as HTMLElement | null) ??
    (postEl.querySelector('[data-placeholder]') as HTMLElement | null)
  );
}

async function openCommentBox(postEl: Element): Promise<void> {
  // If the editor is already visible, skip — we don't want to accidentally click
  // the Submit "Comment" button which may share aria-label selectors.
  if (findCommentBox(postEl)) return;

  const commentBtn =
    (postEl.querySelector('button.comment-button') as HTMLElement | null) ??
    (postEl.querySelector('[aria-label="Comment"]') as HTMLElement | null) ??
    (postEl.querySelector('button[data-control-name="comment"]') as HTMLElement | null);

  if (commentBtn) {
    commentBtn.click();
    await wait(300);
  }
}

export async function insertComment(
  postEl: Element,
  commentText: string
): Promise<boolean> {
  try {
    await openCommentBox(postEl);

    const editor = findCommentBox(postEl);
    if (!editor) {
      console.warn('[LCA] Could not find comment box');
      return false;
    }

    editor.focus();

    // Clear existing content
    editor.innerHTML = '';

    // Try execCommand first (works with Quill)
    const inserted = document.execCommand('insertText', false, commentText);

    if (!inserted || editor.textContent?.trim() !== commentText.trim()) {
      // Fallback: set innerHTML and dispatch events
      editor.innerHTML = commentText;

      editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: commentText }));
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
      editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    }

    editor.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch (err) {
    console.warn('[LCA] Error inserting comment:', err);
    return false;
  }
}
