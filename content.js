// content.js - Version 27 (Debugger + Isolation Strategy)

let searchInterval = null;

function attemptAutoGrab() {
    if (searchInterval) clearInterval(searchInterval);

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

    const readingInterval = setInterval(() => {
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
                    console.log("Preparing Independent Isolation (For Debugger)...");

                    let pageTitle = "Unknown Reading";
                    const h1 = document.querySelector('h1');
                    if (h1) pageTitle = h1.innerText;

                    // --- ISOLATION STRATEGY FOR DEBUGGER ---
                    // The live page has complex CSS (Grid/Flex) that causes overlaps when we force height.
                    // We will COPY the content into a clean, simple BLOCK layout overlay.
                    // The printer will see this clean overlay and paginate it perfectly.

                    // 1. Create Clean Overlay
                    const overlay = document.createElement('div');
                    overlay.id = 'print-isolation-overlay';
                    overlay.style.cssText = `
                        position: absolute; /* Absolute allows full scrolling */
                        top: 0;
                        left: 0;
                        width: 100%;
                        background: white;
                        z-index: 2147483647; /* Max Z-Index */
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    `;

                    // 2. Clone Content
                    const clone = readingContainer.cloneNode(true);

                    // 3. Reset Clone Styles to be Simple Block Flow
                    clone.style.cssText = `
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 800px !important; /* Limit width for readability */
                        margin-left: auto !important;
                        margin-right: auto !important;
                        position: static !important;
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                    `;

                    // 4. Force Body to be simple container for overlay
                    // We hide everything else by making the body a simple wrapper for our overlay
                    // Note: We can't use display:none on body, but we can overlay on top.
                    // Better: We temporarily hide the #appRoot
                    const appRoot = document.getElementById('app');
                    if (appRoot) appRoot.style.display = 'none';

                    document.body.appendChild(overlay);
                    overlay.appendChild(clone);

                    // 5. Force Height on Body now that it only contains our overlay
                    document.body.style.height = 'auto';
                    document.body.style.minHeight = '100vh';
                    document.body.style.overflow = 'visible';
                    document.documentElement.style.overflow = 'visible';
                    document.documentElement.style.height = 'auto';

                    // 6. Reveal Clone Internals
                    const allInClone = clone.querySelectorAll('*');
                    allInClone.forEach(el => {
                        // Ensure no internal fixed heights cause overlap
                        el.style.maxHeight = 'none';
                        if (getComputedStyle(el).display === 'none') {
                            el.style.display = 'block';
                        }
                    });

                    clearInterval(forceShowInterval);

                    // 7. Send Print Command
                    // The Debugger will now print the "Body" which essentially only shows our clean Overlay.
                    setTimeout(() => {
                        chrome.runtime.sendMessage({
                            action: "printWithDebugger",
                            pageTitle: pageTitle
                        });

                        // Optional: Reload after print to restore UI?
                        // For now, let's leave it. User can reload manually if needed or we can add a reload banner.
                    }, 1000); // Small delay for rendering

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

attemptAutoGrab();

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