# Bookmark Checker 书签检查器

A Chrome extension to check and manage your bookmarks efficiently.
一个用于高效检查和管理 Chrome 书签的扩展程序。

## Features 功能特点

- **Bookmark Validation 书签验证**
  - Checks all bookmarks for validity 检查所有书签的有效性
  - Identifies broken/invalid links 识别失效/无效链接
  - Shows real-time progress 显示实时进度

- **Domain Exclusion 域名排除**
  - Exclude specific domains from checking 排除特定域名的检查
  - One domain per line configuration 每行一个域名的配置方式

- **Management Tools 管理工具**
  - Delete individual invalid bookmarks 删除单个无效书签
  - Batch delete all invalid bookmarks 批量删除所有无效书签
  - Real-time statistics display 实时统计数据显示

## Installation 安装方法

1. Download/clone this repository 下载/克隆此仓库
2. Open Chrome and navigate to `chrome://extensions/` 打开 Chrome 并访问 `chrome://extensions/`
3. Enable "Developer mode" 启用"开发者模式"
4. Click "Load unpacked" and select the extension directory 点击"加载已解压的扩展程序"并选择扩展目录

## Usage 使用方法

1. Click the extension icon in Chrome toolbar 点击 Chrome 工具栏中的扩展图标
2. (Optional) Enter domains to exclude in the textarea (Optional) 在文本框中输入要排除的域名
3. Click "Check Bookmarks" to start 点击"检查书签"开始检查
4. Monitor progress and results in real-time 实时监控进度和结果
5. Manage invalid bookmarks as needed 根据需要管理无效书签

## Technical Details 技术细节

- Built with Chrome Extensions Manifest V3
- Uses modern JavaScript features
- Implements both HEAD request and tab-based checking methods
- Real-time progress updates using message passing
- Responsive UI with progress tracking

## Permissions Required 所需权限

- `bookmarks`: For accessing and managing bookmarks
- `tabs`: For advanced URL validation
- `<all_urls>`: For checking bookmark URLs
- `notifications`: For system notifications
- `background`: For background processing

## Contributing 贡献

Feel free to submit issues and enhancement requests!
欢迎提交问题和改进建议！

