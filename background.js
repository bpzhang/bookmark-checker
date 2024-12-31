chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Checker installed');
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkBookmarks') {
    sendResponse({ status: 'received' });
  }
});