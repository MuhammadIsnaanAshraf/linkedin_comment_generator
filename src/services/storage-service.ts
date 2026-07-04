import { GeneratedComment, Reply, ExtensionSettings, StorageData } from '../types';

const STORAGE_KEY = 'lca_data';
const MAX_COMMENTS = 500;
const MAX_REPLIES = 200;

const DEFAULT_SETTINGS: ExtensionSettings = {
  groqApiKeys: [],
  currentKeyIndex: 0,
  commentTone: 'auto',
  enabled: true,
};

async function getData(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY];
      resolve(
        data ?? {
          comments: [],
          replies: [],
          settings: DEFAULT_SETTINGS,
        }
      );
    });
  });
}

async function setData(data: StorageData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

export async function saveComment(comment: GeneratedComment): Promise<void> {
  const data = await getData();
  data.comments.unshift(comment);
  if (data.comments.length > MAX_COMMENTS) {
    data.comments = data.comments.slice(0, MAX_COMMENTS);
  }
  await setData(data);
}

export async function getComments(): Promise<GeneratedComment[]> {
  const data = await getData();
  return data.comments;
}

export async function deleteComment(id: string): Promise<void> {
  const data = await getData();
  data.comments = data.comments.filter((c) => c.id !== id);
  await setData(data);
}

export async function saveReply(reply: Reply): Promise<void> {
  const data = await getData();
  data.replies.unshift(reply);
  if (data.replies.length > MAX_REPLIES) {
    data.replies = data.replies.slice(0, MAX_REPLIES);
  }
  await setData(data);
}

export async function getReplies(): Promise<Reply[]> {
  const data = await getData();
  return data.replies;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await getData();
  return data.settings ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  settings: Partial<ExtensionSettings>
): Promise<void> {
  const data = await getData();
  data.settings = { ...(data.settings ?? DEFAULT_SETTINGS), ...settings };
  await setData(data);
}

export async function clearAll(): Promise<void> {
  await setData({
    comments: [],
    replies: [],
    settings: DEFAULT_SETTINGS,
  });
}

export async function getAllData(): Promise<StorageData> {
  return getData();
}
