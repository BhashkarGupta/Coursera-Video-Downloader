// popup.js

function init() {
    chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'concurrencyLimit', 'useFolderStructure'], (data) => {
        const statusDiv = document.getElementById('status');
        const scanBtn = document.getElementById('scanBtn');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const concurrencyInput = document.getElementById('concurrencyInput');
        const checkVideos = document.getElementById('checkVideos');
        const checkReadings = document.getElementById('checkReadings');
        const folderStructure = document.getElementById('folderStructure');

        // Restore saved limit and folder setting
        if (data.concurrencyLimit) concurrencyInput.value = data.concurrencyLimit;
        if (data.useFolderStructure) folderStructure.checked = data.useFolderStructure;

        // Save setting on change
        folderStructure.addEventListener('change', () => {
            chrome.storage.local.set({ useFolderStructure: folderStructure.checked });
        });

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
        chrome.tabs.sendMessage(tabs[0].id, { action: "scanCourse" }, (response) => {
            init();
        });
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