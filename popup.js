document.getElementById('scanBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "scanCourse" }, (response) => {
            if (chrome.runtime.lastError) {
                document.getElementById('status').innerText = "Error: Refresh page & try again.";
            } else if (response && response.count) {
                document.getElementById('status').innerText = `Queue Ready: ${response.count} videos.`;
            } else {
                document.getElementById('status').innerText = "No videos found. Did you expand modules?";
            }
        });
    });
});

document.getElementById('startBtn').addEventListener('click', () => {
    chrome.storage.local.set({ isJobRunning: true, currentIndex: 0 }, () => {
        chrome.storage.local.get(['videoQueue'], (data) => {
            if (data.videoQueue && data.videoQueue.length > 0) {
                chrome.tabs.update({ url: data.videoQueue[0].url });
                document.getElementById('status').innerText = "Running... Do not close tab.";
            } else {
                document.getElementById('status').innerText = "Queue empty. Scan first.";
            }
        });
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.local.set({ isJobRunning: false }, () => {
        document.getElementById('status').innerText = "STOPPED. Current download will finish, then it halts.";
    });
});