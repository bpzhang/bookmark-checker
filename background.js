// 存储检查状态和结果
let checkingStatus = {
  isChecking: false,
  shouldStop: false,
  progress: {
    checked: 0,
    total: 0,
    validCount: 0,
    invalidCount: 0,
    excludedCount: 0,
    currentBookmark: '',
    results: [],
    lastResults: []
  }
};

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startChecking') {
    if (!checkingStatus.isChecking) {
      checkingStatus.isChecking = true;
      checkingStatus.shouldStop = false;
      checkingStatus.progress = {
        checked: 0,
        total: 0,
        validCount: 0,
        invalidCount: 0,
        excludedCount: 0,
        currentBookmark: '',
        results: [],
        lastResults: []
      };
      Promise.resolve().then(() => startBookmarkCheck(request.excludeDomains));
    }
    sendResponse({ status: 'started', progress: checkingStatus.progress });
  } else if (request.action === 'stopChecking') {
    checkingStatus.shouldStop = true;
    sendResponse({ status: 'stopping' });
  } else if (request.action === 'getProgress') {
    sendResponse({ 
      isChecking: checkingStatus.isChecking,
      progress: {
        ...checkingStatus.progress,
        results: checkingStatus.isChecking ? 
          checkingStatus.progress.results : 
          checkingStatus.progress.lastResults
      }
    });
  }
  return true;
});

async function startBookmarkCheck(excludeDomains) {
  try {
    const bookmarkTreeNodes = await chrome.bookmarks.getTree();
    const bookmarks = [];
    
    function processNode(node) {
      if (node.url) {
        bookmarks.push({ id: node.id, url: node.url, title: node.title });
      }
      if (node.children) {
        node.children.forEach(processNode);
      }
    }
    
    bookmarkTreeNodes.forEach(processNode);
    checkingStatus.progress.total = bookmarks.length;

    for (let i = 0; i < bookmarks.length && !checkingStatus.shouldStop; i++) {
      const bookmark = bookmarks[i];
      
      try {
        const bookmarkUrl = new URL(bookmark.url);
        const bookmarkDomain = bookmarkUrl.hostname;
        if (excludeDomains.some(domain => bookmarkDomain.includes(domain))) {
          checkingStatus.progress.excludedCount++;
          checkingStatus.progress.checked = i + 1;
          continue;
        }
      } catch (e) {
        // URL 解析错误,继续检查
      }

      checkingStatus.progress.currentBookmark = bookmark.title;
      checkingStatus.progress.checked = i + 1;

      try {
        const result = await checkBookmark(bookmark);
        if (result.isValid) {
          checkingStatus.progress.validCount++;
        } else {
          checkingStatus.progress.invalidCount++;
        }
        const resultItem = {
          bookmark,
          isValid: result.isValid,
          status: result.status || result.error
        };
        checkingStatus.progress.results.unshift(resultItem);
        checkingStatus.progress.lastResults.unshift(resultItem);
      } catch (error) {
        checkingStatus.progress.invalidCount++;
        const resultItem = {
          bookmark,
          isValid: false,
          status: error.message
        };
        checkingStatus.progress.results.unshift(resultItem);
        checkingStatus.progress.lastResults.unshift(resultItem);
      }
    }
  } catch (error) {
    console.error('Error checking bookmarks:', error);
  } finally {
    checkingStatus.isChecking = false;
    checkingStatus.shouldStop = false;
  }
}

async function checkBookmark(bookmark) {
  try {
    const response = await fetch(bookmark.url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.status === 404) {
      return { isValid: false, status: '404 Not Found' };
    } else if (response.ok) {
      return { isValid: true, status: response.status };
    } else {
      return checkWithTabs(bookmark);
    }
  } catch (error) {
    return checkWithTabs(bookmark);
  }
}

function checkWithTabs(bookmark) {
  return new Promise((resolve) => {
    chrome.tabs.create(
      { url: bookmark.url, active: false },
      (tab) => {
        setTimeout(() => {
          chrome.tabs.get(tab.id, (checkTab) => {
            chrome.tabs.remove(tab.id);
            const isValid = checkTab && !checkTab.url.startsWith('chrome-error://');
            resolve({
              isValid: isValid,
              status: isValid ? 'OK (Tab Check)' : 'Error (Tab Check)'
            });
          });
        }, 3000);
      }
    );
  });
}