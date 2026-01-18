// content.js - Version 4 (DOM Scraper)

// === PART 1: AUTO-PLAYER & GRABBER ===
function attemptAutoGrab() {
    console.log("Looking for Play button...");
    
    // 1. Try to click Play
    const playButton = document.querySelector('button[data-testid="centerPlayButton"]');
    if (playButton) {
        console.log("Clicking Play...");
        playButton.click();
    }

    // 2. Wait for the <video> tag to appear and have a 'src'
    const checkVideoInterval = setInterval(() => {
        const videoElement = document.querySelector('video');
        
        if (videoElement && videoElement.src && videoElement.src.includes("cloudfront.net")) {
            console.log("Found Video URL in DOM:", videoElement.src);
            
            // STOP CHECKING
            clearInterval(checkVideoInterval);

            // SEND TO BACKGROUND SCRIPT
            chrome.runtime.sendMessage({
                action: "foundVideoUrl",
                url: videoElement.src
            });
        }
    }, 1000); // Check every second
}

// Run immediately on page load
attemptAutoGrab();


// === PART 2: THE COURSE SCANNER (Unchanged) ===
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
                    if (typeLabel && typeLabel.innerText.includes("Video")) {
                        videoCount++;
                        const titleEl = item.querySelector('.css-u7fh1q');
                        const rawTitle = titleEl ? titleEl.innerText : "Unknown";
                        const linkEl = item.querySelector('a');
                        const href = linkEl ? linkEl.getAttribute('href') : "";
                        
                        if (href) {
                            const modNum = moduleName.match(/\d+/)[0].padStart(2, '0');
                            const vidNum = videoCount.toString().padStart(2, '0');
                            const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "_").trim();
                            
                            courseData.push({
                                url: "https://www.coursera.org" + href,
                                filename: `M${modNum}_${vidNum} - ${cleanTitle}.mp4`
                            });
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