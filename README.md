# Coursera Course Downloader

A powerful Chrome Extension to download Coursera course materials, including **Videos** and **Readings (PDF)**, with Parallel downloading support.

## Installation

Since this extension is not on the Chrome Web Store, you must install it in **Developer Mode**.

1.  Clone or Download this repository to a folder on your computer.
2.  Install dependencies with `pnpm install`.
3.  Build the extension with `pnpm build`.
4.  Open **Google Chrome** (or Edge/Brave).
5.  Navigate to `chrome://extensions`.
6.  Toggle **Developer Mode** (top right corner) to **ON**.
7.  Click **Load unpacked**.
8.  Select the `dist/` folder created by the build.

**[For Detailed Instructions](https://www.techfixerlab.com/2026/01/coursera-course-downloader-2026.html)**

## Features

- **Automated Scanning**: Scans the current course page to identify video modules and readings materials.
- **Parallel Downloads**: Supports downloading multiple videos at once (configurable from 1 to 5).
- **Auto-Navigation**: Automatically moves to the next video page to grab the source URL if needed.
- **Filename Cleaning**: Renames files to `ModuleName_VideoName.mp4` format using the actual lesson titles.
- **Queue Management**: Pause, Stop, and Rescan capabilities.

---
## Disclaimer

**Educational Purpose Only.**
This tool is intended for personal archiving of courses you have legally enrolled in, for offline viewing (e.g., traveling without internet). Do not distribute downloaded content. Use responsibly and in accordance with Coursera's Terms of Service.
