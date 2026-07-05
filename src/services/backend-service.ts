const BACKEND_URL = 'http://localhost:3333';

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

export async function generateCommentsFromUrl(url: string): Promise<GenerateFromUrlResult> {
  const response = await fetch(`${BACKEND_URL}/api/generate-comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? `Backend error: ${response.status}`);
  }

  return data;
}
