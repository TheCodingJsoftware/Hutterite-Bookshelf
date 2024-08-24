interface FileData {
    fileName: string;
    relativePath: string;
    fileContent: string;
}

// Function to store files in IndexedDB
async function storeFilesInIndexedDB(files: FileData[]) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FileStorage', 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', {
                    keyPath: 'fileName'
                });
            }
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction('files', 'readwrite');
            const store = transaction.objectStore('files');
            files.forEach(file => {
                store.put(file);
            });

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        };

        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
}

// Fetch files and store them in IndexedDB
async function fetchFiles(): Promise < FileData[] > {
    const response = await fetch('/api/files');
    const files: FileData[] = await response.json();

    try {
        await storeFilesInIndexedDB(files);
    } catch (error) {
        console.error("Error storing files in IndexedDB:", error);
    }

    return files;
}

// Function to retrieve file content from IndexedDB by fileName
async function getFileFromIndexedDB(fileName: string): Promise < FileData | undefined > {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FileStorage', 1);

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction('files', 'readonly');
            const store = transaction.objectStore('files');
            const getRequest = store.get(fileName);

            getRequest.onsuccess = () => {
                resolve(getRequest.result);
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        };

        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
}

function renderFileList(files: FileData[]) {
    const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
    fileListDiv.innerHTML = ''; // Clear any existing content

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.textContent = `${file.relativePath}/${file.fileName}`;
        fileItem.addEventListener('click', () => displayFileContent(file.fileName));
        fileListDiv.appendChild(fileItem);
    });
}
async function getAllFilesFromIndexedDB(): Promise < FileData[] > {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FileStorage', 1);

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction('files', 'readonly');
            const store = transaction.objectStore('files');
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                resolve(getAllRequest.result);
            };

            getAllRequest.onerror = () => {
                reject(getAllRequest.error);
            };
        };

        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
}

// Function to display file content by retrieving it from IndexedDB
async function displayFileContent(fileName: string) {
    try {
        const file = await getFileFromIndexedDB(fileName);
        const fileContentDiv = document.getElementById('file-content') as HTMLDivElement;

        if (file) {
            fileContentDiv.textContent = file.fileContent;
        } else {
            fileContentDiv.textContent = 'File not found in IndexedDB.';
        }
    } catch (error) {
        console.error("Error retrieving file from IndexedDB:", error);
    }
}

async function loadBeerCSS() {
    await import('beercss');
    await import('material-dynamic-colors');
}


async function init() {
    let files: FileData[] = await getAllFilesFromIndexedDB();

    if (files.length > 0) {
        // If there are files in IndexedDB, render them first
        loadBeerCSS().then(() => {
            renderFileList(files);
            console.log("Loaded files from IndexedDB.");
        });
    }

    if (navigator.onLine) {
        try {
            // Fetch new files and update IndexedDB in the background
            files = await fetchFiles();
            // Re-render the file list if new data was fetched
            // loadBeerCSS().then(() => {
            //     renderFileList(files);
            // });
        } catch (error) {
            console.error("Error fetching files from server:", error);
        }
    } else if (files.length === 0) {
        console.log("No internet connection and no data in IndexedDB.");
    }

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/static/service-worker.js');
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        } catch (error) {
            console.log('ServiceWorker registration failed: ', error);
        }
    }
}

window.addEventListener('load', init);