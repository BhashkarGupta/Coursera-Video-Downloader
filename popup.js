// popup.js

function init() {
    chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'concurrencyLimit'], (data) => {
        const statusDiv = document.getElementById('status');
        const scanBtn = document.getElementById('scanBtn');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const concurrencyInput = document.getElementById('concurrencyInput');
        const checkVideos = document.getElementById('checkVideos');
        const checkReadings = document.getElementById('checkReadings');

        // Restore saved limit
        if (data.concurrencyLimit) concurrencyInput.value = data.concurrencyLimit;

        if (data.videoQueue && data.videoQueue.length > 0) {
            const current = (data.currentIndex || 0) + 1;
            const total = data.videoQueue.length;

            // Count Types
            let vidCount = 0;
            let readCount = 0;
            data.videoQueue.forEach(item => {
                if (item.type === 'reading') readCount++;
                else vidCount++;
            });

            if (data.isJobRunning) {
                statusDiv.innerText = `RUNNING: Item ${current} / ${total}\n(Videos: ${vidCount}, Readings: ${readCount})`;
                scanBtn.classList.add('hidden');
                startBtn.classList.add('hidden');
                stopBtn.classList.remove('hidden');
                stopBtn.style.display = "block";
                concurrencyInput.disabled = true;
                checkVideos.disabled = true;
                checkReadings.disabled = true;
            } else {
                statusDiv.innerText = `READY: ${total} items queued.\n(${vidCount} Videos, ${readCount} Readings)`;
                scanBtn.innerText = "Rescan Course";
                scanBtn.classList.remove('hidden');
                startBtn.classList.remove('hidden');
                stopBtn.classList.add('hidden');
                concurrencyInput.disabled = false;
                checkVideos.disabled = false;
                checkReadings.disabled = false;
            }
        } else {
            statusDiv.innerText = "No queue. Please scan.";
            scanBtn.classList.remove('hidden');
            startBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
        }
    });
}

init();

document.getElementById('scanBtn').addEventListener('click', () => {
    document.getElementById('status').innerText = "Scanning... (Expand modules first!)";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        const statusEl = document.getElementById('status');

        if (!tab || !tab.id) {
            statusEl.innerText = "No active tab found. Open Coursera in a normal tab and try again.";
            return;
        }

        const url = tab.url || "";
        const isHttp = url.startsWith("http://") || url.startsWith("https://");
        const isCoursera = url.includes("coursera.org/");

        if (!isHttp) {
            statusEl.innerText = "This page can't be scanned. Please open a Coursera course page (https://www.coursera.org/...) and try again.";
            return;
        }

        if (!isCoursera) {
            statusEl.innerText = "Please open a Coursera course page first, then click Scan Course.";
            return;
        }

        let didInject = false;

        const sendScanMessage = () => {
            chrome.tabs.sendMessage(tab.id, { action: "scanCourse" }, (response) => {
                // If content script isn't present in this tab, Chrome sets lastError.
                if (chrome.runtime.lastError) {
                    if (!didInject) {
                        didInject = true;
                        statusEl.innerText = "Connecting to the page... (If you just updated the extension, this may take a second.)";

                        chrome.scripting.executeScript(
                            { target: { tabId: tab.id }, files: ["content.js"] },
                            () => {
                                if (chrome.runtime.lastError) {
                                    statusEl.innerText = "Couldn't connect to this Coursera tab. Please refresh the page and try Scan Course again.";
                                    return;
                                }
                                sendScanMessage();
                            }
                        );
                        return;
                    }

                    statusEl.innerText = "Couldn't connect to the page. Please refresh the Coursera tab and try again.";
                    return;
                }

                if (response && typeof response.count === "number") {
                    statusEl.innerText = `Scan complete: ${response.count} items found.`;
                }
                init();
            });
        };

        sendScanMessage();
    });
});

document.getElementById('startBtn').addEventListener('click', () => {
    const limit = parseInt(document.getElementById('concurrencyInput').value) || 1;
    const wantVideos = document.getElementById('checkVideos').checked;
    const wantReadings = document.getElementById('checkReadings').checked;

    chrome.storage.local.get(['videoQueue'], (data) => {
        if (!data.videoQueue) return;

        // FILTER QUEUE based on selection
        // We filter BEFORE starting. This essentially "commits" the selection.
        // If they want to restore, they must Rescan.
        const filteredQueue = data.videoQueue.filter(item => {
            if (item.type === 'video' && wantVideos) return true;
            if (item.type === 'reading' && wantReadings) return true;
            return false;
        });

        if (filteredQueue.length === 0) {
            document.getElementById('status').innerText = "Nothing selected to download!";
            return;
        }

        // Save filtered queue and Start
        chrome.storage.local.set({
            videoQueue: filteredQueue,
            isJobRunning: true,
            concurrencyLimit: limit,
            isNavigating: false,
            currentIndex: 0 // Reset index on new start
        }, () => {
            // Trigger first navigation
            if (filteredQueue[0]) {
                chrome.tabs.update({ url: filteredQueue[0].url });
                window.close();
            }
            init();
        });
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.local.set({
        isJobRunning: false,
        isNavigating: false,
        videoQueue: [],   // Clear Queue
        currentIndex: 0   // Reset Index
    }, () => {
        document.getElementById('status').innerText = "STOPPED (Queue Cleared).";
        init();
        alert("Stopped and Queue Cleared.");
    });
});

document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.storage.local.clear(() => {
        document.getElementById('status').innerText = "Memory Cleared.";
        init();
    });
});