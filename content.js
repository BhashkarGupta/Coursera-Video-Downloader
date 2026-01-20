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
        const courseData = [];
        const moduleHeaders = document.querySelectorAll('[data-testid="module-number-heading"]');

        moduleHeaders.forEach((header) => {
            const moduleName = header.innerText.trim();
            const moduleContainer = header.closest('.cds-AccordionRoot-container');

            if (moduleContainer) {
                const items = moduleContainer.querySelectorAll('li');
                let videoCount = 0;
                items.forEach((item) => {
                    const typeLabel = item.querySelector('.css-1rhvk9j');
                    if (typeLabel) {
                        const typeText = typeLabel.innerText;
                        let itemType = null;

                        // Treat Reading as Reading if possible, or fallback
                        if (typeText.includes("Video")) itemType = 'video';
                        else if (typeText.includes("Reading")) itemType = 'reading';

                        if (itemType) {
                            if (itemType === 'video') videoCount++;
                            else if (itemType === 'reading') videoCount++;

                            const titleEl = item.querySelector('.css-u7fh1q');
                            const rawTitle = titleEl ? titleEl.innerText : "Unknown";
                            const linkEl = item.querySelector('a');
                            const href = linkEl ? linkEl.getAttribute('href') : "";

                            if (href) {
                                const modNum = moduleName.match(/\d+/)[0].padStart(2, '0');
                                const vidNum = videoCount.toString().padStart(2, '0');
                                let cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "_").trim();

                                const extension = itemType === 'video' ? '.mp4' : '.pdf';

                                courseData.push({
                                    url: "https://www.coursera.org" + href,
                                    filename: `M${modNum}_${vidNum} - ${cleanTitle}${extension}`,
                                    type: itemType
                                });
                            }
                        }
                    }
                });
            }
        });

        chrome.storage.local.set({ videoQueue: courseData, currentIndex: 0 }, () => {
            sendResponse({ count: courseData.length });
        });
        return true;
    }
});