let updateInterval = null;

// 添加页面加载时的状态检查
document.addEventListener('DOMContentLoaded', async () => {
  const response = await chrome.runtime.sendMessage({ action: 'getProgress' });
  if (response.isChecking) {
    // 如果后台正在检查，更新UI并启动进度更新
    const button = document.getElementById('checkBookmarks');
    const stopButton = document.getElementById('stopButton');
    button.disabled = true;
    button.textContent = '检查中...';
    stopButton.style.display = 'block';
    startProgressUpdate();
  }
});

document.getElementById('checkBookmarks').addEventListener('click', async () => {
  const button = document.getElementById('checkBookmarks');
  const stopButton = document.getElementById('stopButton');
  const results = document.getElementById('results');
  const excludeDomains = document.getElementById('excludeDomains').value
    .split('\n')
    .map(domain => domain.trim())
    .filter(domain => domain.length > 0);

  // 清空之前的结果
  results.innerHTML = '';
  
  button.disabled = true;
  button.textContent = '检查中...';
  stopButton.style.display = 'block';
  
  // 开始检查
  chrome.runtime.sendMessage({ 
    action: 'startChecking',
    excludeDomains
  }, response => {
    if (response.status === 'started') {
      startProgressUpdate();
    }
  });
});

document.getElementById('stopButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopChecking' });
  document.getElementById('stopButton').disabled = true;
  document.getElementById('stopButton').textContent = '正在停止...';
});

function startProgressUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  updateInterval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ action: 'getProgress' });
    updateUI(response);
  }, 500);
}

function updateUI(response) {
  const { isChecking, progress } = response;
  const button = document.getElementById('checkBookmarks');
  const stopButton = document.getElementById('stopButton');
  const results = document.getElementById('results');
  const progressBar = document.querySelector('.progress-bar-fill');
  const currentBookmark = document.getElementById('currentBookmark');
  const checkedCount = document.getElementById('checkedCount');
  const totalCount = document.getElementById('totalCount');

  if (!isChecking) {
    clearInterval(updateInterval);
    button.disabled = false;
    button.textContent = '重新检查';
    stopButton.style.display = 'none';
  }

  // 更新进度
  const percent = (progress.checked / progress.total) * 100;
  progressBar.style.width = `${percent}%`;
  checkedCount.textContent = progress.checked;
  totalCount.textContent = progress.total;
  currentBookmark.textContent = progress.currentBookmark ? 
    `正在检查: ${progress.currentBookmark}` : 
    `检查完成! 有效: ${progress.validCount}, 无效: ${progress.invalidCount}, 已排除: ${progress.excludedCount}`;

  // 更新结果列表
  while (progress.results.length > 0) {
    const result = progress.results.pop();
    const resultDiv = createResultDiv(
      result.bookmark,
      result.isValid,
      result.status
    );
    results.insertBefore(resultDiv, results.firstChild);
  }

  // 如果检查完成且有无效书签，显示无效书签列表
  const invalidSection = document.querySelector('.invalid-bookmarks-section');
  if (!isChecking && progress.invalidCount > 0) {
    invalidSection.style.display = 'block';
    updateInvalidList(progress.lastResults.filter(result => !result.isValid));
  } else if (!isChecking) {
    invalidSection.style.display = 'none';
  }
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

// 添加更新无效书签列表的函数
function updateInvalidList(invalidResults) {
  const invalidList = document.getElementById('invalidList');
  invalidList.innerHTML = '';

  invalidResults.forEach(result => {
    const item = document.createElement('div');
    item.className = 'invalid-item';
    item.innerHTML = `
      <div>
        <div>${result.bookmark.title}</div>
        <div class="bookmark-url">${result.bookmark.url}</div>
        <div style="font-size: 11px; color: #666;">状态: ${result.status}</div>
      </div>
      <button class="delete-button" data-bookmark-id="${result.bookmark.id}">删除</button>
    `;

    // 添加删除按钮事件
    const deleteButton = item.querySelector('.delete-button');
    deleteButton.addEventListener('click', () => deleteBookmark(result.bookmark.id, item));

    invalidList.appendChild(item);
  });
}

// 添加删除单个书签的函数
async function deleteBookmark(id, element) {
  try {
    await chrome.bookmarks.remove(id);
    element.remove();
    
    // 检查是否还有无效书签
    const invalidList = document.getElementById('invalidList');
    if (invalidList.children.length === 0) {
      document.querySelector('.invalid-bookmarks-section').style.display = 'none';
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
  }
}

// 添加删除所有无效书签的事件处理
document.getElementById('deleteAllInvalid').addEventListener('click', async () => {
  const deleteButton = document.getElementById('deleteAllInvalid');
  deleteButton.disabled = true;
  deleteButton.textContent = '正在删除...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getProgress' });
    const invalidBookmarks = response.progress.lastResults.filter(result => !result.isValid);
    
    for (const result of invalidBookmarks) {
      await chrome.bookmarks.remove(result.bookmark.id);
    }
    
    // 隐藏无效书签区域
    document.querySelector('.invalid-bookmarks-section').style.display = 'none';
  } catch (error) {
    console.error('Error deleting invalid bookmarks:', error);
  } finally {
    deleteButton.disabled = false;
    deleteButton.textContent = '删除所有无效书签';
  }
});