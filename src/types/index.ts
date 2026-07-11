export type PostCategory = 'professional' | 'casual' | 'hiring' | 'achievement' | 'unknown';

export interface ExtractedPost {
  postId: string;
  authorName: string;
  authorHeadline: string;
  postText: string;
  hasImage: boolean;
  hasVideo: boolean;
  imageAlt?: string;
  videoCaption?: string;
  category: PostCategory;
  extractedAt: string;
}

export interface GeneratedComment {
  id: string;
  postId: string;
  authorName: string;
  postContent: string;
  comment1: string;
  comment2: string;
  selectedComment?: string;
  category: PostCategory;
  timestamp: string;
}

export interface Reply {
  id: string;
  originalCommentId: string;
  originalComment: string;
  replyText: string;
  replyAuthor: string;
  timestamp: string;
}

export interface StorageData {
  comments: GeneratedComment[];
  replies: Reply[];
  settings: ExtensionSettings;
}

export interface ExtensionSettings {
  groqApiKeys: string[];
  currentKeyIndex: number;
  commentTone: 'professional' | 'conversational' | 'auto';
  enabled: boolean;
}

export interface AuthUser {
  id: string;
  email?: string;
}

// The session the extension persists locally (chrome.storage.local['lca_auth']).
// Tokens are issued by Supabase via the backend; expires_at is a unix ts (secs).
export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChromeMessage {
  type:
    | 'SAVE_COMMENT'
    | 'GET_COMMENTS'
    | 'DELETE_COMMENT'
    | 'SAVE_REPLY'
    | 'GET_REPLIES'
    | 'GET_SETTINGS'
    | 'UPDATE_SETTINGS'
    | 'SYNC_TO_DASHBOARD'
    | 'SYNC_DATA_PAYLOAD';
  payload?: any;
}
