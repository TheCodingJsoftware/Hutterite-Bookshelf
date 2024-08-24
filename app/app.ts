async function loadFiles() {
    const response = await fetch('/files');
    const files = await response.json();
    // Process and display files
}

// On button press, load the file from memory
function loadFileFromMemory(fileName: string) {
    caches.match(`/files/${fileName}`).then(response => {
        if (response) {
            response.text().then(content => {
                // Display content in UI
            });
        }
    });
}
