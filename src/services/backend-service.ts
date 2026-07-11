import { BACKEND_URL } from './config';
import { getAccessToken, refreshOrClear } from './auth-service';

export interface GenerateFromUrlResult {
  comment1: string;
  comment2: string;
  category: string;
  videoTranscript?: string;
  post: {
    authorName: string;
    postText: string;
  };
}

export class AuthRequiredError extends Error {
  constructor(message = 'Please log in to generate comments.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

async function requestGenerate(url: string, token: string): Promise<Response> {
  return fetch(`${BACKEND_URL}/api/generate-comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
}

export async function generateCommentsFromUrl(url: string): Promise<GenerateFromUrlResult> {
  let token: string;
  try {
    token = await getAccessToken();
  } catch {
    throw new AuthRequiredError();
  }

  let response = await requestGenerate(url, token);

  // If the token was rejected (revoked/rotated), try one refresh + retry before
  // giving up and forcing a re-login.
  if (response.status === 401) {
    const refreshed = await refreshOrClear();
    if (!refreshed) throw new AuthRequiredError('Session expired. Please log in again.');
    response = await requestGenerate(url, refreshed);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) throw new AuthRequiredError('Session expired. Please log in again.');
    throw new Error(data?.error ?? `Backend error: ${response.status}`);
  }

  return data;
}
