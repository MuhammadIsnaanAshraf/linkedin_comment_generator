import {
  saveComment,
  getComments,
  deleteComment,
  saveReply,
  getReplies,
  getSettings,
  updateSettings,
  getAllData,
} from '../services/storage-service';
import { ChromeMessage } from '../types';

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  if (!settings) {
    await updateSettings({
      groqApiKeys: [],
      currentKeyIndex: 0,
      commentTone: 'auto',
      enabled: true,
    });
  }
});

chrome.runtime.onMessage.addListener(
  (message: ChromeMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      sendResponse({ error: err?.message ?? 'Unknown error' });
    });
    return true; // Keep message channel open for async response
  }
);

async function handleMessage(message: ChromeMessage): Promise<any> {
  switch (message.type) {
    case 'SAVE_COMMENT':
      await saveComment(message.payload);
      return { success: true };

    case 'GET_COMMENTS':
      return await getComments();

    case 'DELETE_COMMENT':
      await deleteComment(message.payload.id);
      return { success: true };

    case 'SAVE_REPLY':
      await saveReply(message.payload);
      return { success: true };

    case 'GET_REPLIES':
      return await getReplies();

    case 'GET_SETTINGS':
      return await getSettings();

    case 'UPDATE_SETTINGS':
      await updateSettings(message.payload);
      return { success: true };

    case 'SYNC_TO_DASHBOARD': {
      const data = await getAllData();
      // Find open dashboard tabs and send data
      chrome.tabs.query({ url: ['http://localhost:3000/*', 'http://localhost:3001/*'] }, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SYNC_DATA_PAYLOAD',
              payload: data,
            });
          }
        }
      });
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// Broadcast storage changes to open dashboard tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes['lca_data']) return;

  chrome.tabs.query({ url: ['http://localhost:3000/*', 'http://localhost:3001/*'] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SYNC_DATA_PAYLOAD',
          payload: changes['lca_data'].newValue,
        }).catch(() => {});
      }
    }
  });
});
