// background.js - Version 4 (Message Receiver)
let isProcessing = false;

// LISTEN FOR MESSAGES FROM content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === "foundVideoUrl") {
        console.log("Received URL from Content Script:", request.url);
        handleVideoDownload(request.url);
    }
});

async function handleVideoDownload(url) {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning']);
      
    // 1. Safety Checks
    if (!data.isJobRunning) {
        console.log("Ignored: Job not running.");
        return;
    }
    if (isProcessing) {
        console.log("Ignored: Already processing a video.");
        return;
    }

    // 2. Match current video
    const currentVideo = data.videoQueue[data.currentIndex];
    if (!currentVideo) {
        console.log("Queue finished.");
        chrome.storage.local.set({ isJobRunning: false });
        return;
    }

    isProcessing = true; // LOCK

    // 3. Download
    console.log(`Downloading: ${currentVideo.filename}`);
    
    chrome.downloads.download({
        url: url,
        filename: `Coursera_Course/${currentVideo.filename}`,
        conflictAction: "overwrite"
    }, (downloadId) => {
        // 4. Move to Next
        processNext(data);
    });
}

function processNext(data) {
    const nextIndex = data.currentIndex + 1;
    
    if (nextIndex >= data.videoQueue.length) {
        console.log("All done.");
        chrome.storage.local.set({ isJobRunning: false });
        isProcessing = false;
        return;
    }

    chrome.storage.local.set({ currentIndex: nextIndex }, () => {
        console.log("Waiting 5s then navigating...");
        
        setTimeout(() => {
            chrome.storage.local.get(['isJobRunning'], (latest) => {
                if (!latest.isJobRunning) {
                    isProcessing = false;
                    return;
                }

                const nextUrl = data.videoQueue[nextIndex].url;
                
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if(tabs[0]) {
                         chrome.tabs.update(tabs[0].id, { url: nextUrl });
                         // UNLOCK only after we are sure we navigated
                         setTimeout(() => { isProcessing = false; }, 4000);
                    }
                });
            });
        }, 5000); 
    });
}