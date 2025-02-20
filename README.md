# Bookmark Checker

A Chrome extension to check and manage your bookmarks efficiently.

## Features

- **Bookmark Validation**
  - Checks all bookmarks for validity
  - Identifies broken/invalid links
  - Shows real-time progress

- **Domain Exclusion**
  - Exclude specific domains from checking
  - One domain per line configuration

- **Management Tools**
  - Delete individual invalid bookmarks
  - Batch delete all invalid bookmarks
  - Real-time statistics display
  - Displays error types

## Installation

1. Download/clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in Chrome toolbar
2. (Optional) Enter domains to exclude in the textarea
3. Click "Check Bookmarks" to start
4. Monitor progress and results in real-time
5. Manage invalid bookmarks as needed

## Technical Details

- Built with Chrome Extensions Manifest V3
- Uses modern JavaScript features
- Implements both HEAD request and tab-based checking methods (HEAD and GET)
- Real-time progress updates using message passing
- Responsive UI with progress tracking
- Utilizes internationalization (i18n) for multiple languages

## Error Types

The extension categorizes bookmark errors into the following types:

- 404 Not Found
- Server Error (500 series)
- Timeout
- Network Error
- DNS Error
- Other Errors

## Configuration

- `maxConcurrent`: Configures the maximum number of concurrent bookmark checks in [background.js](background.js).
- `batchSize`: Configures the number of bookmarks processed in each batch in [background.js](background.js).

## Permissions Required

- `bookmarks`: For accessing and managing bookmarks
- `tabs`: For advanced URL validation
- `<all_urls>`: For checking bookmark URLs
- `notifications`: For system notifications
- `background`: For background processing

## Contributing

Feel free to submit issues and enhancement requests!