import { ExtractedPost, PostCategory } from '../types';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function extractText(postEl: Element): string {
  const feedText = postEl.querySelector('.feed-shared-text');
  if (feedText) {
    const spans = feedText.querySelectorAll('span');
    let text = Array.from(spans)
      .map((s) => s.textContent ?? '')
      .join(' ');
    text = text.replace(/\.\.\.see more/gi, '').replace(/\.\.\.show less/gi, '').trim();
    if (text.length > 0) return text;
  }

  const descEl = postEl.querySelector('.feed-shared-update-v2__description');
  if (descEl) {
    return (descEl.textContent ?? '')
      .replace(/\.\.\.see more/gi, '')
      .replace(/\.\.\.show less/gi, '')
      .trim();
  }

  return '';
}

// LinkedIn's redesign hashes its CSS classes, but the author/headline block
// keeps a semantic componentkey. Its first two <p> children are always the
// name and headline, in that order.
const IDENTITY_MODULE_SELECTOR = '[componentkey="feedIdentityModuleComponentRef"]';

function getIdentityParagraphs(postEl: Element): HTMLElement[] {
  const identityModule = postEl.querySelector(IDENTITY_MODULE_SELECTOR);
  console.debug('[LCA] getIdentityParagraphs: postEl=', postEl, 'identityModule found=', !!identityModule);
  return identityModule ? Array.from(identityModule.querySelectorAll('p')) : [];
}

function extractAuthorName(postEl: Element): string {
  const nameP = getIdentityParagraphs(postEl)[0];
  if (nameP?.textContent?.trim()) return nameP.textContent.trim();

  const nameEl = postEl.querySelector(
    '.update-components-actor__name span[aria-hidden="true"]'
  );
  if (nameEl?.textContent) return nameEl.textContent.trim();

  const fallback = postEl.querySelector('.feed-shared-actor__name');
  return (fallback?.textContent ?? 'Unknown').trim();
}

function extractAuthorHeadline(postEl: Element): string {
  const headlineP = getIdentityParagraphs(postEl)[1];
  if (headlineP?.textContent?.trim()) return headlineP.textContent.trim();

  const headlineEl = postEl.querySelector(
    '.update-components-actor__description span[aria-hidden="true"]'
  );
  return (headlineEl?.textContent ?? '').trim();
}

function extractImage(postEl: Element): { hasImage: boolean; imageAlt?: string } {
  const imgEl = postEl.querySelector('.feed-shared-image__container img');
  if (imgEl) {
    return { hasImage: true, imageAlt: imgEl.getAttribute('alt') ?? undefined };
  }
  return { hasImage: false };
}

function extractVideo(postEl: Element): { hasVideo: boolean; videoCaption?: string } {
  const videoEl = postEl.querySelector('.feed-shared-linkedin-video') ?? postEl.querySelector('video');
  if (videoEl) {
    const caption =
      videoEl.getAttribute('aria-label') ?? videoEl.getAttribute('data-title') ?? undefined;
    return { hasVideo: true, videoCaption: caption };
  }
  return { hasVideo: false };
}

function extractPostId(postEl: Element, authorName: string, postText: string): string {
  const urn = postEl.getAttribute('data-urn');
  if (urn) return urn;

  const dataId = postEl.getAttribute('data-id');
  if (dataId) return dataId;

  return simpleHash(authorName + postText.slice(0, 50));
}

function detectCategory(text: string): PostCategory {
  const lower = text.toLowerCase();

  const hiringKeywords = [
    "we're hiring",
    'we are hiring',
    'job opening',
    'looking for',
    'join our team',
    'open role',
    'applying',
    'now hiring',
    'job opportunity',
    'career opportunity',
  ];
  if (hiringKeywords.some((kw) => lower.includes(kw))) return 'hiring';

  const achievementKeywords = [
    'excited to announce',
    'thrilled',
    'proud to share',
    'just launched',
    'promoted',
    'happy to share',
    'delighted to announce',
    'just joined',
    'officially',
  ];
  if (achievementKeywords.some((kw) => lower.includes(kw))) return 'achievement';

  if (text.length < 100 || text.includes('?')) return 'casual';

  return 'professional';
}

export function extractPost(postEl: Element): ExtractedPost | null {
  try {
    const postText = extractText(postEl);
    const authorName = extractAuthorName(postEl);
    const authorHeadline = extractAuthorHeadline(postEl);
    const { hasImage, imageAlt } = extractImage(postEl);
    const { hasVideo, videoCaption } = extractVideo(postEl);
    const postId = extractPostId(postEl, authorName, postText);
    const category = detectCategory(postText);

    return {
      postId,
      authorName,
      authorHeadline,
      postText,
      hasImage,
      hasVideo,
      imageAlt,
      videoCaption,
      category,
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
