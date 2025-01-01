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

// 添加并发检测的配置
const CHECK_CONFIG = {
  maxConcurrent: 5,  // 最大并发数
  batchSize: 10      // 每批处理的书签数
};

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startChecking') {
    // 完全重置检查状态
    checkingStatus = {
      isChecking: true,
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
    Promise.resolve().then(() => startBookmarkCheck(request.excludeDomains));
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

    // 处理排除域名
    const filteredBookmarks = [];
    for (const bookmark of bookmarks) {
      try {
        const bookmarkUrl = new URL(bookmark.url);
        const bookmarkDomain = bookmarkUrl.hostname;
        if (excludeDomains.some(domain => bookmarkDomain.includes(domain))) {
          checkingStatus.progress.excludedCount++;
          checkingStatus.progress.checked++;
          continue;
        }
        filteredBookmarks.push(bookmark);
      } catch (e) {
        filteredBookmarks.push(bookmark);
      }
    }

    // 分批处理书签
    for (let i = 0; i < filteredBookmarks.length && !checkingStatus.shouldStop; i += CHECK_CONFIG.batchSize) {
      const batch = filteredBookmarks.slice(i, i + CHECK_CONFIG.batchSize);
      const batchPromises = batch.map(bookmark => {
        checkingStatus.progress.currentBookmark = bookmark.title;
        return checkBookmark(bookmark).then(result => ({
          bookmark,
          result
        }));
      });

      // 并发执行检查
      const results = await Promise.allSettled(batchPromises);
      
      // 处理结果
      for (const result of results) {
        if (checkingStatus.shouldStop) break;
        
        if (result.status === 'fulfilled') {
          const { bookmark, result: checkResult } = result.value;
          if (checkResult.isValid) {
            checkingStatus.progress.validCount++;
          } else {
            checkingStatus.progress.invalidCount++;
          }
          
          const resultItem = {
            bookmark,
            isValid: checkResult.isValid,
            status: checkResult.status || checkResult.error
          };
          
          checkingStatus.progress.results.unshift(resultItem);
          checkingStatus.progress.lastResults.unshift(resultItem);
        } else {
          // 处理检查失败的情况
          checkingStatus.progress.invalidCount++;
          const resultItem = {
            bookmark: result.reason.bookmark,
            isValid: false,
            status: result.reason.message || 'Check failed'
          };
          checkingStatus.progress.results.unshift(resultItem);
          checkingStatus.progress.lastResults.unshift(resultItem);
        }
        checkingStatus.progress.checked++;
      }

      // 给UI更新和系统一个喘息的机会
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Error checking bookmarks:', error);
  } finally {
    checkingStatus.isChecking = false;
    checkingStatus.shouldStop = false;
  }
}

// 修改检查书签的函数
async function checkBookmark(bookmark) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // 首先尝试 HEAD 请求
    const response = await fetch(bookmark.url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { isValid: true, status: response.status };
    }

    // 如果 HEAD 请求失败，尝试 GET 请求
    const getController = new AbortController();
    const getTimeoutId = setTimeout(() => getController.abort(), 5000);

    try {
      const getResponse = await fetch(bookmark.url, {
        method: 'GET',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(getTimeoutId);
      
      // 处理各种状态码
      switch (true) {
        case getResponse.ok:
          return { isValid: true, status: 'GET: ' + getResponse.status };
          
        case [401, 403].includes(getResponse.status):
          return { isValid: true, status: `Requires auth: ${getResponse.status}` };
          
        case getResponse.status === 404:
          return { isValid: false, status: '404 Not Found' };
          
        case getResponse.status === 429:
          await new Promise(resolve => setTimeout(resolve, 2000));
          return { isValid: true, status: 'Rate limited: 429' };
          
        case getResponse.status >= 500:
          return { isValid: true, status: `Server error: ${getResponse.status}` };
          
        case [301, 302, 303, 307, 308].includes(getResponse.status):
          // 处理重定向
          if (getResponse.headers.get('location')) {
            return { isValid: true, status: `Redirect: ${getResponse.status}` };
          }
          return { isValid: false, status: `Invalid redirect: ${getResponse.status}` };
          
        default:
          return { isValid: false, status: `Unexpected status: ${getResponse.status}` };
      }
    } catch (getError) {
      clearTimeout(getTimeoutId);
      
      // 处理特殊错误
      switch (true) {
        case getError.message.includes('SSL') || getError.message.includes('certificate'):
          return { isValid: true, status: 'SSL/Certificate issue' };
          
        case getError.message.includes('CORS'):
          return { isValid: true, status: 'CORS restricted' };
          
        case getError.name === 'AbortError':
          return { isValid: false, status: 'GET Timeout' };
          
        case getError.message.includes('ECONNREFUSED'):
          return { isValid: false, status: 'Connection refused' };
          
        case getError.message.includes('ETIMEDOUT'):
          return { isValid: false, status: 'Connection timed out' };
          
        case getError.message.includes('getaddrinfo'):
          return { isValid: false, status: 'DNS lookup failed' };
          
        default:
          return { isValid: false, status: `Network error: ${getError.message}` };
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return { isValid: false, status: 'HEAD Timeout' };
    }

    // 如果 HEAD 请求失败，直接尝试 GET 请求
    const getController = new AbortController();
    const getTimeoutId = setTimeout(() => getController.abort(), 5000);

    try {
      const getResponse = await fetch(bookmark.url, {
        method: 'GET',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(getTimeoutId);
      
      if (getResponse.ok) {
        return { isValid: true, status: 'GET: ' + getResponse.status };
      }
      
      // 处理特殊状态码
      if ([401, 403, 429, 500, 502, 503, 504].includes(getResponse.status)) {
        return { isValid: true, status: `Service available: ${getResponse.status}` };
      }
      
      if (getResponse.status === 404) {
        return { isValid: false, status: '404 Not Found' };
      }

      return { isValid: false, status: `Failed: ${getResponse.status}` };
    } catch (getError) {
      clearTimeout(getTimeoutId);
      
      if (getError.name === 'AbortError') {
        return { isValid: false, status: 'All requests timeout' };
      }
      
      // 处理其他网络错误
      return { isValid: false, status: `Error: ${getError.message}` };
    }
  }
}