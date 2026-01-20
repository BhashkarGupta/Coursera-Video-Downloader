## Project Overview

This repository is a simple Chrome Extension for Coursera users. It downloads:
- Videos (with subtitles)
- PDF readings (page content)

The project is intentionally small and should stay simple.

## Current State

- No `package.json`
- No build system (extension is loaded as unpacked)
- Minified JS is copy-pasted into the repo
- Goal: use `pnpm` once a build is introduced

## Scope and Principles

- Keep the extension lightweight and easy to understand.
- Avoid complex build tooling unless it clearly improves maintainability.
- Prefer plain JS and minimal dependencies.

## File Layout (Key Files)

- `manifest.json` - Chrome Extension manifest
- `background.js` - background logic
- `content.js` - content script logic
- `popup.html` / `popup.js` - UI
- `html2pdf.bundle.min.js` - vendored/minified dependency

## Planned Improvements (Near Term)

1. Add `package.json` and switch to `pnpm`
2. Introduce a simple build step for the extension
3. Replace copy-pasted minified JS with a managed dependency (e.g., via `pnpm`)

## Contribution Notes

- Prefer minimal changes that keep the project approachable.
- When adding tooling, document the build and dev workflow in `README.md`.
- Keep new dependencies small and justified.
