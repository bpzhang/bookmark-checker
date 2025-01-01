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