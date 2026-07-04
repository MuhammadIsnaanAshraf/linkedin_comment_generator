import { ExtractedPost } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama3-70b-8192';
const KEY_RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Keys injected from .env at build time
const ENV_KEYS: string[] = [
  process.env.GROQ_KEY_1 as string,
  process.env.GROQ_KEY_2 as string,
].filter(Boolean);

const SYSTEM_PROMPT = `You are a LinkedIn engagement expert. Generate exactly 2 distinct, human-sounding comments for the LinkedIn post provided.

Rules:
- Each comment must be 1-3 sentences maximum
- Sound like a real professional wrote it, not AI
- Be specific to the post content, not generic
- No filler phrases like "Great post!", "Thanks for sharing!", "This is so insightful!"
- Match tone: professional posts → professional tone, casual → conversational
- For hiring posts: write from a job-seeker or supportive colleague perspective
- For achievements: congratulate specifically, mention what impressed you
- Never start both comments the same way
- Never use hashtags in comments

Return ONLY this JSON, no other text:
{
  "comment1": "first comment text here",
  "comment2": "second comment text here",
  "category": "professional|casual|hiring|achievement"
}`;

function buildUserPrompt(post: ExtractedPost): string {
  let prompt = `Post by ${post.authorName} (${post.authorHeadline}):\n\n${post.postText}`;
  if (post.hasImage) {
    prompt += `\n\nContains an image: ${post.imageAlt || 'image attached'}`;
  }
  if (post.hasVideo) {
    prompt += `\n\nContains a video: ${post.videoCaption || 'video attached'}`;
  }
  prompt += '\n\nGenerate 2 comments for this post.';
  return prompt;
}

async function callGroqAPI(
  apiKey: string,
  post: ExtractedPost
): Promise<{ comment1: string; comment2: string; category: string }> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(post) },
      ],
    }),
  });

  if (!response.ok) {
    const err = new Error(`Groq API error: ${response.status}`) as any;
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';

  let parsed: { comment1: string; comment2: string; category: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Retry once: try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error('API response is not valid JSON');
      }
    } else {
      throw new Error('API response is not valid JSON');
    }
  }

  if (!parsed.comment1 || !parsed.comment2) {
    throw new Error('API response missing comment fields');
  }

  return parsed;
}

async function getCurrentKeyIndex(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get('lca_key_index', (result) => {
      resolve(result['lca_key_index'] ?? 0);
    });
  });
}

async function saveKeyIndex(index: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ lca_key_index: index }, resolve);
  });
}

async function checkAndResetKeyIndex(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('lca_key_reset', (result) => {
      const lastReset = result['lca_key_reset'] ?? 0;
      if (Date.now() - lastReset > KEY_RESET_INTERVAL_MS) {
        chrome.storage.local.set({ lca_key_reset: Date.now() }, async () => {
          await saveKeyIndex(0);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

export async function generateComments(
  post: ExtractedPost
): Promise<{ comment1: string; comment2: string; category: string }> {
  if (ENV_KEYS.length === 0) {
    throw new Error('No Groq API keys configured. Add them to the .env file and rebuild the extension.');
  }

  await checkAndResetKeyIndex();
  const currentIndex = await getCurrentKeyIndex();

  for (let attempt = 0; attempt < ENV_KEYS.length; attempt++) {
    const keyIndex = (currentIndex + attempt) % ENV_KEYS.length;
    try {
      const result = await callGroqAPI(ENV_KEYS[keyIndex], post);
      await saveKeyIndex(keyIndex);
      return result;
    } catch (error: any) {
      if (error.status === 429 || error.status === 401) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('All Groq API keys exhausted or invalid');
}
