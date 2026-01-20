// content.js - Version 29 (Auto-Restore UI)

let searchInterval = null;
let readingInterval = null;

function attemptAutoGrab() {
    if (searchInterval) clearInterval(searchInterval);
    if (readingInterval) clearInterval(readingInterval);

    const playBtn = document.querySelector('button[data-testid="centerPlayButton"]');
    if (playBtn) playBtn.click();

    searchInterval = setInterval(async () => {
        const btn = document.querySelector('button[data-testid="centerPlayButton"]');
        if (btn) btn.click();

        const videoElement = document.querySelector('video');
        if (videoElement && videoElement.src && videoElement.src.includes("cloudfront.net")) {
            console.log("FOUND VIDEO SOURCE:", videoElement.src);
            clearInterval(searchInterval);
            videoElement.pause();

            let pageTitle = "Unknown Video";
            const h1 = document.querySelector('h1');
            if (h1) pageTitle = h1.innerText;

            chrome.runtime.sendMessage({
                action: "foundVideoUrl",
                url: videoElement.src,
                pageTitle: pageTitle,
                type: 'video'
            });
            return;
        }

        const readingContainer = document.querySelector('.rc-ReadingItem');
        if (readingContainer) {
            console.log("FOUND READING CONTAINER - Initial Check");
            clearInterval(searchInterval);
        }
    }, 2000);

    // REVEAL LOGIC
    function aggressiveReveal(element) {
        if (!element) return;

        let curr = element;
        while (curr && curr.tagName !== 'BODY') {
            const style = getComputedStyle(curr);
            if (style.display === 'none') {
                curr.style.setProperty('display', 'block', 'important');
                curr.style.setProperty('visibility', 'visible', 'important');
                curr.style.setProperty('opacity', '1', 'important');
            }
            curr = curr.parentElement;
        }

        const buggedContainer = document.querySelector('.css-jgflq0');
        if (buggedContainer) {
            buggedContainer.style.setProperty('display', 'block', 'important');
            const inner = buggedContainer.querySelector('div');
            if (inner) inner.style.setProperty('display', 'block', 'important');
        }
    }

    let readingAttempts = 0;
    const MAX_ATTEMPTS = 15;

    readingInterval = setInterval(() => {
        const readingContainer = document.querySelector('.rc-ReadingItem');

        if (readingContainer) {
            const contentBody = document.querySelector('.rc-CML');
            const hasContent = contentBody && (contentBody.innerText.trim().length > 50 || contentBody.children.length > 0);

            if (hasContent) {
                console.log("Content detected. Waiting 3s for stability...");
                clearInterval(readingInterval);
                if (searchInterval) clearInterval(searchInterval);

                const forceShowInterval = setInterval(() => {
                    aggressiveReveal(readingContainer);
                }, 100);

                setTimeout(() => {
                    console.log("Preparing Nuclear Isolation (With Auto-Restore)...");

                    let pageTitle = "Unknown Reading";
                    const h1 = document.querySelector('h1');
                    if (h1) pageTitle = h1.innerText;

                    // STORE ORIGINAL STATE for restoration
                    const originalBodyStyle = document.body.style.cssText;
                    const originalHtmlStyle = document.documentElement.style.cssText;
                    const hiddenElements = [];

                    // 1. Create Overlay
                    const overlay = document.createElement('div');
                    overlay.id = 'print-isolation-overlay';
                    overlay.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        min-height: 100vh;
                        background: white;
                        z-index: 2147483647;
                        margin: 0;
                        padding: 40px; 
                        box-sizing: border-box;
                    `;

                    // 2. Clone Content
                    const clone = readingContainer.cloneNode(true);
                    clone.style.cssText = `
                        margin: 0 auto !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 800px !important;
                        display: block !important;
                        position: static !important;
                    `;

                    // 3. NUCLEAR STEP: Hide Sibling Elements
                    const bodyChildren = Array.from(document.body.children);
                    bodyChildren.forEach(child => {
                        if (child.tagName !== 'SCRIPT' && child.style.display !== 'none') {
                            hiddenElements.push({ element: child, originalDisplay: child.style.display });
                            child.style.display = 'none';
                        }
                    });

                    // 4. Nuke Fixed Elements
                    const allFixed = document.querySelectorAll('*');
                    allFixed.forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.position === 'fixed' || style.position === 'sticky') {
                            // We can't easily restore these individually without massive overhead,
                            // but usually they come back when we reload or navigate.
                            // For now, we only hide them via style injection or direct property if critical.
                            // Actually, let's skip deep nuking to ensure easier restore, 
                            // relies on the Overlay covering them (z-index max).
                            // The Body Children hide should cover most app-level headers.
                        }
                    });

                    document.body.appendChild(overlay);
                    overlay.appendChild(clone);

                    // 5. Force Body Specs
                    document.body.style.setProperty('height', 'auto', 'important');
                    document.body.style.setProperty('min-height', '100vh', 'important');
                    document.body.style.setProperty('overflow', 'visible', 'important');
                    document.body.style.setProperty('background', 'white', 'important');
                    document.documentElement.style.setProperty('height', 'auto', 'important');
                    document.documentElement.style.setProperty('overflow', 'visible', 'important');

                    // 6. Reveal Clone
                    const allInClone = clone.querySelectorAll('*');
                    allInClone.forEach(el => {
                        el.style.maxHeight = 'none';
                        if (getComputedStyle(el).display === 'none') el.style.display = 'block';
                    });

                    clearInterval(forceShowInterval);

                    // 7. PRINT & RESTORE
                    setTimeout(() => {
                        chrome.runtime.sendMessage({
                            action: "printWithDebugger",
                            pageTitle: pageTitle
                        }, () => {
                            // CALLBACK AFTER PRINT (Simple auto-restore)
                            // Note: Message passing is async, but we can't confirm *when* print is done from here easily without complex roundtrip.
                            // We will set a reasonable timeout to restore the UI.

                            setTimeout(() => {
                                console.log("Restoring UI...");
                                if (document.body.contains(overlay)) document.body.removeChild(overlay);

                                // Restore Body
                                document.body.style.cssText = originalBodyStyle;
                                document.documentElement.style.cssText = originalHtmlStyle;

                                // Restore Hidden Elements
                                hiddenElements.forEach(item => {
                                    item.element.style.display = item.originalDisplay;
                                });
                            }, 5000); // 5 seconds to allow PDF generation to likely complete capture
                        });
                    }, 1000);

                }, 3000);

            } else {
                console.log("Waiting for content...");
                readingAttempts++;
            }
        } else {
            if (document.querySelector('.rc-ReadingItem')) readingAttempts++;
        }

        if (readingAttempts >= MAX_ATTEMPTS) {
            clearInterval(readingInterval);
            console.error("Timeout waiting for Reading content.");
        }
    }, 2000);
}

function stopAutoGrab() {
    if (searchInterval) {
        clearInterval(searchInterval);
        searchInterval = null;
    }
    if (readingInterval) {
        clearInterval(readingInterval);
        readingInterval = null;
    }
}

function startAutoGrabIfRunning() {
    chrome.storage.local.get(['isJobRunning'], (data) => {
        if (data && data.isJobRunning) {
            attemptAutoGrab();
        } else {
            stopAutoGrab();
        }
    });
}

// Only run auto-grab while a download job is active.
startAutoGrabIfRunning();
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes.isJobRunning) return;

    if (changes.isJobRunning.newValue) startAutoGrabIfRunning();
    else stopAutoGrab();
});

// SCANNER (Unchanged)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanCourse") {
        // Coursera frequently changes CSS classnames. Keep scanning logic resilient:
        // - Prefer module/accordion scanning when stable attributes exist.
        // - Fallback to URL-pattern scanning (lecture/supplement) if needed.

        const now = Date.now();

        function sanitizeFilenamePart(text) {
            return (text || "Unknown")
                .replace(/[\\/:*?"<>|]/g, "_")
                .replace(/\s+/g, " ")
                .trim();
        }

        function normalizeToAbsoluteCourseraUrl(href) {
            if (!href) return "";
            if (href.startsWith("http://") || href.startsWith("https://")) return href;
            if (href.startsWith("/")) return "https://www.coursera.org" + href;
            return "";
        }

        function classifyFromHref(url) {
            const u = (url || "").toLowerCase();
            // Common Coursera lesson URL patterns:
            // - .../lecture/... => video
            // - .../supplement/... => reading
            // - sometimes .../reading/... exists as well
            if (u.includes("/lecture/")) return "video";
            if (u.includes("/supplement/") || u.includes("/reading/")) return "reading";
            return null;
        }

        function titleFromAnchor(a) {
            const raw =
                (a && a.innerText) ||
                (a && a.getAttribute && a.getAttribute("aria-label")) ||
                (a && a.getAttribute && a.getAttribute("title")) ||
                "";
            const cleaned = sanitizeFilenamePart(raw);
            if (!cleaned) return "Unknown";
            // If the anchor contains extra metadata lines, keep the most "title-like" last line.
            const lines = cleaned.split("\n").map(s => s.trim()).filter(Boolean);
            return lines.length ? lines[lines.length - 1] : cleaned;
        }

        function scanFromModuleHeaders() {
            const courseData = [];

            const moduleHeaders = document.querySelectorAll(
                '[data-testid="module-number-heading"], [data-testid="week-number-heading"], [data-testid="week-heading"]'
            );

            moduleHeaders.forEach((header, moduleIdx) => {
                const moduleName = (header.innerText || "").trim();
                // Try common "accordion container" patterns, but don't rely on CSS-only selectors.
                const moduleContainer =
                    header.closest('[class*="Accordion"]') ||
                    header.closest('section') ||
                    header.parentElement;

                if (!moduleContainer) return;

                // Find items in this module. Prefer list items if present.
                const items = moduleContainer.querySelectorAll('li, [role="listitem"]');
                let itemCount = 0;

                items.forEach((item) => {
                    const linkEl = item.querySelector('a[href]');
                    const href = linkEl ? linkEl.getAttribute('href') : "";
                    const absUrl = normalizeToAbsoluteCourseraUrl(href);
                    const itemType = classifyFromHref(absUrl);
                    if (!itemType || !absUrl) return;

                    itemCount++;

                    // Title heuristics: prefer link text, then nearby headings/spans.
                    let rawTitle = titleFromAnchor(linkEl);
                    if (rawTitle === "Unknown") {
                        const maybeTitle =
                            item.querySelector('h3, h4, [data-testid*="title"], span')?.innerText || "";
                        rawTitle = sanitizeFilenamePart(maybeTitle) || "Unknown";
                    }

                    const modNumMatch = moduleName.match(/\d+/);
                    const modNum = (modNumMatch ? modNumMatch[0] : String(moduleIdx + 1)).padStart(2, "0");
                    const itemNum = String(itemCount).padStart(2, "0");
                    const extension = itemType === "video" ? ".mp4" : ".pdf";

                    courseData.push({
                        url: absUrl,
                        filename: `M${modNum}_${itemNum} - ${sanitizeFilenamePart(rawTitle)}${extension}`,
                        type: itemType
                    });
                });
            });

            // De-dupe while keeping order.
            const seen = new Set();
            return courseData.filter(x => {
                if (!x || !x.url) return false;
                if (seen.has(x.url)) return false;
                seen.add(x.url);
                return true;
            });
        }

        function scanFromAnchorsFallback() {
            const allAnchors = Array.from(document.querySelectorAll('a[href]'));
            const items = [];
            const seen = new Set();

            for (const a of allAnchors) {
                const absUrl = normalizeToAbsoluteCourseraUrl(a.getAttribute("href"));
                if (!absUrl) continue;

                const itemType = classifyFromHref(absUrl);
                if (!itemType) continue;

                // Avoid duplicates and noisy navigation links.
                if (seen.has(absUrl)) continue;
                seen.add(absUrl);

                const title = titleFromAnchor(a);
                const idx = items.length + 1;
                const itemNum = String(idx).padStart(2, "0");
                const extension = itemType === "video" ? ".mp4" : ".pdf";

                items.push({
                    url: absUrl,
                    filename: `M01_${itemNum} - ${sanitizeFilenamePart(title)}${extension}`,
                    type: itemType
                });
            }

            return items;
        }

        let courseData = [];
        let scanSource = "modules";
        try {
            courseData = scanFromModuleHeaders();
            if (!courseData || courseData.length === 0) {
                scanSource = "anchors";
                courseData = scanFromAnchorsFallback();
            }
        } catch (e) {
            console.error("Scan failed:", e);
            scanSource = "error";
            courseData = [];
        }

        chrome.storage.local.set(
            {
                videoQueue: courseData,
                currentIndex: 0,
                lastScanCount: courseData.length,
                lastScanAt: now,
                lastScanSource: scanSource
            },
            () => {
                sendResponse({ count: courseData.length, source: scanSource });
            }
        );

        return true; // keep sendResponse channel open
    }
});
