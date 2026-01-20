// background.js - Version 13 (Debugger API Restored)

// Helper: Get real active downloads count from Chrome
function getActiveCount() {
    return new Promise((resolve) => {
        chrome.downloads.search({ state: 'in_progress' }, (items) => {
            const myDownloads = items.filter(item => item.byExtensionId === chrome.runtime.id);
            resolve(myDownloads.length);
        });
    });
}

// 1. RECEIVE URL (Video) or TRIGGER (Debugger)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "foundVideoUrl") {
        attemptDownload(request.url, request.pageTitle, 'video');
    }
    else if (request.action === "printWithDebugger") {
        // Only print/download during an active job.
        chrome.storage.local.get(['isJobRunning'], (data) => {
            if (!data || !data.isJobRunning) return;
            if (sender.tab && sender.tab.id) {
                handleDebuggerPrint(sender.tab.id, request.pageTitle);
            }
        });
    }
});

// --- DEBUGGER PRINT LOGIC ---
async function handleDebuggerPrint(tabId, scrapedTitle) {
    try {
        console.log(`Attaching Debugger to tab ${tabId}...`);

        await chrome.debugger.attach({ tabId: tabId }, "1.3");
        await chrome.debugger.sendCommand({ tabId: tabId }, "Page.enable");

        // 1. SET TABLET EMULATION (User Request: 800px)
        await chrome.debugger.sendCommand({ tabId: tabId }, "Emulation.setDeviceMetricsOverride", {
            width: 800,      // Tablet Width
            height: 1600,    // Height (arbitrary)
            deviceScaleFactor: 2,
            mobile: true
        });

        console.log("Generating PDF via Debugger...");

        // 3. PRINT TO PDF
        const pdfResult = await chrome.debugger.sendCommand({ tabId: tabId }, "Page.printToPDF", {
            printBackground: true,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            paperWidth: 8.27, // A4
            paperHeight: 11.69,
            transferMode: 'ReturnAsStream' // Use Stream to avoid size limits
        });

        // 4. READ STREAM (If provided) or DATA
        let dataUrl = '';
        if (pdfResult.stream) {
            // If it returns a stream handle, we'd need to read it. 
            // However, typical `printToPDF` under 10MB returns .data directly if transferMode is default.
            // Let's rely on standard data first to avoid complexity, or checking if chrome returns data with 'ReturnAsStream' if small enough.
            // Actually, let's use default mode (base64) for simplicity unless it fails.
        }

        // RETRY with Base64 Mode if stream logic is complex to implement blindly
        // Making a second call with standard mode
        const pdfResultBase64 = await chrome.debugger.sendCommand({ tabId: tabId }, "Page.printToPDF", {
            printBackground: true,
            marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
            paperWidth: 8.27, paperHeight: 11.69
            // No transferMode = Base64 string return
        });

        await chrome.debugger.detach({ tabId: tabId });

        dataUrl = 'data:application/pdf;base64,' + pdfResultBase64.data;
        attemptDownload(dataUrl, scrapedTitle, 'reading');

    } catch (err) {
        console.error("Debugger Print Failed:", err);
        try { await chrome.debugger.detach({ tabId: tabId }); } catch (e) { }
    }
}

async function attemptDownload(url, scrapedTitle, type = 'video') {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'concurrencyLimit']);

    if (!data.isJobRunning) return;

    if (!url || (!url.startsWith("http:") && !url.startsWith("https:") && !url.startsWith("data:"))) {
        console.error("Skipping unsafe/invalid URL");
        await chrome.storage.local.set({ isNavigating: false });
        processQueue();
        return;
    }

    const currentVideo = data.videoQueue[data.currentIndex];
    let finalFilename = currentVideo.filename;

    // Fix Unknown Titles
    if (finalFilename.includes("Unknown") && scrapedTitle) {
        const prefix = finalFilename.split('-')[0];
        let cleanScraped = scrapedTitle.replace(/[\\/:*?"<>|]/g, "_").trim();
        if (cleanScraped.length > 200) cleanScraped = cleanScraped.substring(0, 200);

        const ext = type === 'reading' ? '.pdf' : '.mp4';

        if (!cleanScraped.endsWith(ext) && !cleanScraped.endsWith('.html')) {
            finalFilename = `${prefix}- ${cleanScraped}${ext}`;
        } else {
            finalFilename = `${prefix}- ${cleanScraped}`;
        }
    }

    console.log(`Starting Download: ${finalFilename}`);

    chrome.downloads.download({
        url: url,
        filename: `Coursera_Course/${finalFilename}`,
        conflictAction: "overwrite"
    }, async (downloadId) => {
        if (chrome.runtime.lastError) console.log("DL Error:", chrome.runtime.lastError);

        // JOB DONE
        await chrome.storage.local.set({ isNavigating: false });
        processQueue();
    });
}

chrome.downloads.onChanged.addListener(async (delta) => {
    if (delta.state && delta.state.current === 'complete') {
        processQueue();
    }
});

async function processQueue() {
    const data = await chrome.storage.local.get(['isJobRunning', 'concurrencyLimit', 'isNavigating']);
    if (!data.isJobRunning || data.isNavigating) return;

    const activeCount = await getActiveCount();
    const limit = data.concurrencyLimit || 1;

    if (activeCount < limit) {
        navigateNext();
    }
}

async function navigateNext() {
    await chrome.storage.local.set({ isNavigating: true });

    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex']);
    const nextIndex = data.currentIndex + 1;

    if (nextIndex >= data.videoQueue.length) {
        console.log("Queue finished.");
        await chrome.storage.local.set({ isNavigating: false });
        return;
    }

    await chrome.storage.local.set({ currentIndex: nextIndex });
    const nextUrl = data.videoQueue[nextIndex].url;
    console.log(`Navigating to #${nextIndex + 1}: ${nextUrl}`);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: nextUrl });
        } else {
            // Fallback
            chrome.tabs.query({ active: true }, function (allTabs) {
                if (allTabs[0]) {
                    chrome.tabs.update(allTabs[0].id, { url: nextUrl });
                } else {
                    chrome.storage.local.set({ isNavigating: false });
                }
            });
        }
    });
}