document.getElementById('checkBookmarks').addEventListener('click', async () => {
  const button = document.getElementById('checkBookmarks');
  const stopButton = document.getElementById('stopButton');
  const results = document.getElementById('results');
  const progressBar = document.querySelector('.progress-bar-fill');
  const currentBookmark = document.getElementById('currentBookmark');
  const checkedCount = document.getElementById('checkedCount');
  const totalCount = document.getElementById('totalCount');
  const excludeDomainsTextarea = document.getElementById('excludeDomains');
  
  // 获取排除域名列表
  const excludeDomains = excludeDomainsTextarea.value
    .split('\n')
    .map(domain => domain.trim())
    .filter(domain => domain.length > 0);
  
  // 用于控制是否停止检查
  let shouldStop = false;
  
  // 显示停止按钮
  stopButton.style.display = 'block';
  stopButton.addEventListener('click', () => {
    shouldStop = true;
    stopButton.disabled = true;
    stopButton.textContent = '正在停止...';
  });
  
  // 禁用开始按钮
  button.disabled = true;
  button.textContent = '检查中...';
  
  results.innerHTML = '';
  let validCount = 0;
  let invalidCount = 0;
  let excludedCount = 0;

  // 获取所有书签
  chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
    const bookmarks = [];
    
    // 递归获取所有书签
    function processNode(node) {
      if (node.url) {
        bookmarks.push({ id: node.id, url: node.url, title: node.title });
      }
      if (node.children) {
        node.children.forEach(processNode);
      }
    }
    
    bookmarkTreeNodes.forEach(processNode);
    
    // 更新总数
    totalCount.textContent = bookmarks.length;
    
    // 检查每个书签
    for (let i = 0; i < bookmarks.length; i++) {
      // 如果用户点击了停止按钮，则中断检查
      if (shouldStop) {
        currentBookmark.textContent = `检查已停止! 有效: ${validCount}, 无效: ${invalidCount}, 已排除: ${excludedCount}`;
        button.disabled = false;
        button.textContent = '重新检查';
        stopButton.style.display = 'none';
        return;
      }

      const bookmark = bookmarks[i];
      
      // 检查是否在排除列表中
      try {
        const bookmarkUrl = new URL(bookmark.url);
        const bookmarkDomain = bookmarkUrl.hostname;
        if (excludeDomains.some(domain => bookmarkDomain.includes(domain))) {
          excludedCount++;
          checkedCount.textContent = i + 1;
          continue;
        }
      } catch (e) {
        // URL 解析错误,继续检查
      }
      
      // 更新进度条和当前检查的书签
      const progress = ((i + 1) / bookmarks.length) * 100;
      progressBar.style.width = `${progress}%`;
      currentBookmark.textContent = `正在检查: ${bookmark.title}`;
      checkedCount.textContent = i + 1;

      try {
        // 使用新的检查方法
        const result = await checkBookmark(bookmark);
        
        if (result.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }

        const resultDiv = createResultDiv(bookmark, result.isValid, result.status || result.error);
        results.insertBefore(resultDiv, results.firstChild);
        
      } catch (error) {
        invalidCount++;
        const resultDiv = createResultDiv(bookmark, false, error.message);
        results.insertBefore(resultDiv, results.firstChild);
      }
    }

    // 检查完成后更新状态
    currentBookmark.textContent = `检查完成! 有效: ${validCount}, 无效: ${invalidCount}, 已排除: ${excludedCount}`;
    button.disabled = false;
    button.textContent = '重新检查';
    stopButton.style.display = 'none';
  });
});

async function checkBookmark(bookmark) {
  return new Promise((resolve) => {
    // 首先尝试使用 fetch
    fetch(bookmark.url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    .then(response => {
      if (response.status === 404) {
        resolve({
          isValid: false,
          status: `404 Not Found`
        });
      } else if (response.ok) {
        resolve({
          isValid: true,
          status: response.status
        });
      } else {
        // 如果 HEAD 请求失败，使用 chrome.tabs 方法
        checkWithTabs(bookmark, resolve);
      }
    })
    .catch(() => {
      // 如果 fetch 失败，使用 chrome.tabs 方法
      checkWithTabs(bookmark, resolve);
    });
  });
}

function checkWithTabs(bookmark, resolve) {
  chrome.tabs.create(
    { 
      url: bookmark.url, 
      active: false // 在后台打开
    }, 
    (tab) => {
      // 给页面 3 秒加载时间
      setTimeout(() => {
        // 检查标签页状态
        chrome.tabs.get(tab.id, (checkTab) => {
          // 关闭检查用的标签页
          chrome.tabs.remove(tab.id);
          
          // 如果标签页仍然存在且没有错误页面，则认为链接有效
          const isValid = checkTab && !checkTab.url.startsWith('chrome-error://');
          
          resolve({
            isValid: isValid,
            status: isValid ? 'OK (Tab Check)' : 'Error (Tab Check)'
          });
        });
      }, 3000);
    }
  );
}

function createResultDiv(bookmark, isValid, status) {
  const resultDiv = document.createElement('div');
  resultDiv.className = isValid ? 'valid' : 'invalid';
  resultDiv.innerHTML = `
    <div>
      ${bookmark.title}
      <a href="${bookmark.url}" target="_blank" class="action-link">打开链接</a>
    </div>
    <div class="bookmark-url">${bookmark.url}</div>
    <div style="font-size: 12px;">
      ${isValid ? '✓ 有效' : '✗ 无效'} - ${status}
    </div>
  `;
  return resultDiv;
}