import React, { useState } from 'react';
import { ExtractedPost, GeneratedComment } from '../../types';
import { generateComments } from '../../services/groq-service';
import { saveComment } from '../../services/storage-service';
import { insertComment } from '../comment-inserter';

interface Props {
  post: ExtractedPost;
  postEl: Element;
  onClose: () => void;
}

type PanelState = 'loading' | 'loaded' | 'error';

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function CommentPanel({ post, postEl, onClose }: Props) {
  const [state, setState] = useState<PanelState>('loading');
  const [comment1, setComment1] = useState('');
  const [comment2, setComment2] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [category, setCategory] = useState(post.category);

  React.useEffect(() => {
    fetchComments();
  }, []);

  async function fetchComments() {
    setState('loading');
    setErrorMsg('');
    try {
      const result = await generateComments(post);
      setComment1(result.comment1);
      setComment2(result.comment2);
      setCategory(result.category as any ?? post.category);
      setState('loaded');
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      if (msg.includes('offline') || msg.includes('Failed to fetch')) {
        setErrorMsg('No internet connection');
      } else if (msg.includes('keys exhausted')) {
        setErrorMsg('Quota limit reached. All API keys exhausted.');
      } else if (msg.includes('No Groq API keys')) {
        setErrorMsg('No API keys configured. Add keys in the extension popup.');
      } else {
        setErrorMsg('Could not generate comments. Check API key.');
      }
      setState('error');
    }
  }

  async function handleUse(commentText: string) {
    const inserted = await insertComment(postEl, commentText);
    if (inserted) {
      const record: GeneratedComment = {
        id: genId(),
        postId: post.postId,
        authorName: post.authorName,
        postContent: post.postText,
        comment1,
        comment2,
        selectedComment: commentText,
        category,
        timestamp: new Date().toISOString(),
      };
      await saveComment(record);
    }
    onClose();
  }

  return (
    <div className="lca-panel">
      <div className="lca-panel-header">
        <p className="lca-panel-title">AI Suggestions</p>
        <button className="lca-close-btn" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="lca-panel-body">
        {state === 'loading' && (
          <>
            <div className="lca-comment-card lca-skeleton">
              <div className="lca-skeleton-line" />
              <div className="lca-skeleton-line" />
              <div className="lca-skeleton-line" />
            </div>
            <div className="lca-comment-card lca-skeleton">
              <div className="lca-skeleton-line" />
              <div className="lca-skeleton-line" />
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="lca-error-msg">{errorMsg}</p>
            <button className="lca-retry-btn" onClick={fetchComments}>Retry</button>
          </>
        )}

        {state === 'loaded' && (
          <>
            <div className="lca-comment-card">
              <p className="lca-comment-text">{comment1}</p>
              <button className="lca-use-btn" onClick={() => handleUse(comment1)}>Use this</button>
            </div>
            <div className="lca-comment-card">
              <p className="lca-comment-text">{comment2}</p>
              <button className="lca-use-btn" onClick={() => handleUse(comment2)}>Use this</button>
            </div>
            <div className="lca-panel-actions">
              <button className="lca-regen-btn" onClick={fetchComments}>Regenerate</button>
            </div>
          </>
        )}
      </div>

      <div className="lca-panel-footer">Powered by Groq · Not auto-posted</div>
    </div>
  );
}
