import 'beercss';
import 'material-dynamic-colors';
import 'remixicon/fonts/remixicon.css';
import '../static/css/style.css';
import '../static/css/theme.css';

interface FileData {
    fileName: string;
    relativePath: string;
    fileContent: string;
    isPrivate: boolean;
}interface FolderData {
    folderName: string;
    adminAccess: boolean;
}

let selectedFiles = new Set<string>();
let globalDBFiles: FileData[] = []
let customDBFiles: FileData[] = []
let currentParagraphIndex = 0;
let focusEnabled = false;
let flattenedFileList: FileData[] = [];
let currentSongIndex = -1;
let debounceTimer: number | null = null; // For filtering songs
let isSelectableMode = false;
let publicFolders: string[] = [];
const LONG_PRESS_DURATION = 500; // Duration in milliseconds to consider a long press
let longPressTimer: number | null = null;

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    const installButton = document.getElementById('install-pwa');
    if (installButton) {
        installButton.style.display = 'flex';
    }

    console.log('beforeinstallprompt event fired');
});


function escapeRegExp(string: string): string {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

function isMobileDevice() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

function saveCustomFoldersToLocalStorage(folders: FolderData[]) {
    localStorage.setItem('customFolders', JSON.stringify(folders));
}

function getCustomFoldersFromLocalStorage(): FolderData[] {
    const folders = localStorage.getItem('customFolders');
    return folders ? JSON.parse(folders) : [];
}

function addFolderToCustomFolders(folderName: string, adminAccess: boolean) {
    const folders = getCustomFoldersFromLocalStorage();
    const existingFolder = folders.find(f => f.folderName === folderName);

    if (!existingFolder) {
        folders.push({ folderName, adminAccess });
        saveCustomFoldersToLocalStorage(folders);
    } else {
        console.log(`Folder "${folderName}" already exists in customFolders.`);
    }
}

function removeFolderFromCustomFolders(folderName: string) {
    let folders = getCustomFoldersFromLocalStorage();
    if (folders.some(f => f.folderName === folderName)) {
        folders = folders.filter(f => f.folderName !== folderName);
        saveCustomFoldersToLocalStorage(folders);
    } else {
        console.log(`Folder "${folderName}" does not exist in customFolders.`);
    }
}

async function initGlobalDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GlobalFiles', 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: ['relativePath', 'fileName'] });
            }
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
}

async function initCustomCollectionDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CustomCollections', 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: ['relativePath', 'fileName'] });
            }
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
}

async function cleanUpCustomDB(selectedFolders: string[], db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const file = cursor.value as FileData;
                const isInSelectedFolders = selectedFolders.some(folder => file.relativePath === folder);

                if (!isInSelectedFolders) {
                    cursor.delete();
                }
                cursor.continue();
            } else {
                resolve();
            }
        };

        request.onerror = () => reject(request.error);
    });
}

async function storeFilesinDB(files: FileData[], db: IDBDatabase) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');

        files.forEach(file => {
            if (file.relativePath && file.fileName) {
                store.put(file);
            } else {
                console.error('File data missing relativePath or fileName:', file);
            }
        });

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
    });
}

async function fetchAllPublicFolders(): Promise<string[]> {
    const response = await fetch('/api/public_folders');
    const folders: string[] = await response.json();
    return folders;
}

async function fetchGlobalFiles(db: IDBDatabase): Promise<FileData[]> {
    const response = await fetch('/api/files?type=global');
    const files: FileData[] = await response.json();

    try {
        await storeFilesinDB(files, db);
    } catch (error) {
        console.error("Error storing files in IndexedDB:", error);
    }

    return files;
}

async function fetchCustomCollectionFiles(db: IDBDatabase, foldersData: FolderData[]): Promise<FileData[]> {
    const params = new URLSearchParams({ type: 'custom' });
    const folders = foldersData.map(folder => folder.folderName);
    folders.forEach(folder => params.append('folders', folder));

    const response = await fetch(`/api/files?${params.toString()}`);
    const files: FileData[] = await response.json();

    try {
        await storeFilesinDB(files, db);
    } catch (error) {
        console.error("Error storing files in IndexedDB:", error);
    }
    return files;
}

function flattenFileTree(tree: any, basePath: string = '') {
    const naturalSort = (a: string, b: string) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    Object.keys(tree).sort(naturalSort).forEach(key => {
        const value = tree[key];
        const currentPath = basePath ? `${basePath}\\${key}` : key;

        if (Array.isArray(value)) {
            value.forEach((file: FileData) => {
                flattenedFileList.push(file);
            });
        } else {
            flattenFileTree(value, currentPath);
        }
    });
}

async function filterSongs(query: string) {
    const [globalDB, customDB] = await Promise.all([
        initGlobalDB(),
        initCustomCollectionDB(),
    ]);

    const helperText = document.querySelector('#search-songs .helper') as HTMLElement;

    if (query === '') {
        renderFileList(globalDBFiles, globalDB, customDBFiles, customDB);
        helperText.textContent = '';
        return;
    }
    let filteredFiles: FileData[] = globalDBFiles.filter(file =>
        file.fileName.toLowerCase().includes(query.toLowerCase())
    );
    filteredFiles = filteredFiles.concat(customDBFiles.filter(file =>
        file.fileName.toLowerCase().includes(query.toLowerCase())
    ));

    console.log(filteredFiles);


    helperText.textContent = `${filteredFiles.length} result${filteredFiles.length !== 1 ? 's' : ''} found`;

    renderFilteredFileList(filteredFiles, query);
}

async function updateFileSelectionVisuals() {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const fileName = item.getAttribute('data-file-name');
        const icon = item.querySelector('i') as HTMLElement;
        if (isSelectableMode) {
            item.classList.add('selectable');
            icon.textContent = 'check_box';
        } else {
            item.classList.remove('selectable');
            icon.textContent = 'check_box_outline_blank';
        }

        if (fileName && selectedFiles.has(fileName)) {
            item.classList.add('selected');
            icon.textContent = 'check_box';
        } else {
            item.classList.remove('selected');
            icon.textContent = 'check_box_outline_blank';
        }
    });
}

function getFileButton(file: FileData): HTMLElement {
    const fileContainer = document.createElement('div');

    const icon = document.createElement('i');
    icon.textContent = selectedFiles.has(file.fileName) ? 'check_box' : 'check_box_outline_blank';
    icon.className = 's2';

    const header = document.createElement('h6');
    header.className = 'small s10';
    header.textContent = file.fileName.replace('.txt', '');

    const fileButton = document.createElement('a');
    fileButton.setAttribute('data-file-name', file.fileName);
    fileButton.className = 'file-item padding surface-container no-round wave wrap grid';
    fileButton.appendChild(header);
    fileButton.insertBefore(icon, fileButton.firstChild);


    fileContainer.appendChild(fileButton);

    if (selectedFiles.has(file.fileName)) {
        fileButton.classList.add('selected');
    }

    let touchMoved = false;

    const startLongPress = () => {
        longPressTimer = window.setTimeout(() => {
            const selectSongsToggle = document.getElementById('select-songs-toggle') as HTMLInputElement;
            selectSongsToggle.checked = !selectSongsToggle.checked;
            const event = new Event('change');
            selectSongsToggle.dispatchEvent(event);
        }, LONG_PRESS_DURATION);
    };

    const cancelLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    fileButton.addEventListener('mousedown', startLongPress);
    fileButton.addEventListener('mouseup', cancelLongPress);
    fileButton.addEventListener('mouseleave', cancelLongPress);

    fileButton.addEventListener('touchstart', (event) => {
        touchMoved = false;
        startLongPress();
    });

    fileButton.addEventListener('touchend', () => {
        if (!touchMoved) {
            cancelLongPress();
        }
    });

    fileButton.addEventListener('touchmove', () => {
        touchMoved = true;
        cancelLongPress();
    });

    fileButton.addEventListener('click', (event) => {
        if (isSelectableMode) {
            event.preventDefault();
            fileButton.classList.toggle('selected');
            if (fileButton.classList.contains('selected')) {
                selectedFiles.add(file.fileName);
                icon.textContent = 'check_box';
            } else {
                selectedFiles.delete(file.fileName);
                icon.textContent = 'check_box_outline_blank';
            }
        } else {
            displayFileContent(file);
        }
    });

    return fileContainer;
}

function getCustomFileButton(file: FileData, showText: boolean = true): HTMLElement {
    const fileButton = document.createElement('a');
    fileButton.className = 'custom-file-item padding surface-container no-round wave wrap';
    if (showText) {
        fileButton.textContent = file.fileName.replace('.txt', '');
    }
    fileButton.setAttribute('data-file-name', file.fileName);
    fileButton.addEventListener('click', (event) => {
        event.preventDefault();
        displayFileContent(file);
    });
    return fileButton;
}

async function renderFilteredFileList(files: FileData[], query: string) {
    const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
    fileListDiv.innerHTML = '';
    const customContent = document.getElementById('custom-collections-container') as HTMLDivElement;
    customContent.style.display = 'none';

    if (files.length === 0) {
        const noResults = document.createElement('article');
        noResults.className = 'margin padding';
        noResults.textContent = 'No results found.';
        fileListDiv.appendChild(noResults);
        return
    }

    const content = document.createElement('article');
    content.className = "scroll margin";

    const fragment = document.createDocumentFragment();

    files.forEach(file => {
        const escapedQuery = escapeRegExp(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');

        const fileContainer = getFileButton(file);
        const fileButton = fileContainer.querySelector('a') as HTMLAnchorElement;
        fileButton.className = 'small-padding wave file-item wrap no-round grid';

        const headline = fileButton.querySelector('h6') as HTMLHeadingElement;
        headline.innerHTML = headline.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1');
        headline.innerHTML = headline.textContent!.replace(regex, '<span class="highlight">$1</span>');

        const supportingText = document.createElement('p');
        supportingText.className = "small s12 right-align";
        supportingText.textContent = file.relativePath;
        fileButton.appendChild(supportingText);

        fragment.appendChild(fileContainer);

        const divider = document.createElement('div');
        divider.className = 'divider';
        fragment.appendChild(divider);
    });

    content.appendChild(fragment);
    fileListDiv.appendChild(content);
    updateFileSelectionVisuals();
}

async function renderFileList(globalFiles: FileData[], globalDB: IDBDatabase, customFiles: FileData[], customDB: IDBDatabase) {
    const globalFileListDiv = document.getElementById('file-list') as HTMLDivElement;
    const customFileListDiv = document.getElementById('custom-collections-file-list') as HTMLDivElement;
    const customCollectionsContainer = document.getElementById('custom-collections-container') as HTMLDivElement;
    flattenedFileList = [];
    const globalFileTree: { [key: string]: any } = {};
    const customFileTree: { [key: string]: any } = {};

    globalFileListDiv.innerHTML = '';
    customFileListDiv.innerHTML = '';

    if (customFiles.length > 0) {
        customCollectionsContainer.style.display = 'block';
    }else{
        customCollectionsContainer.style.display = 'none';
    }


    const naturalSort = (a: string, b: string) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    globalFiles.forEach(file => {
        const pathParts = file.relativePath.split('\\');
        let currentLevel = globalFileTree;

        pathParts.forEach((part, index) => {
            if (!currentLevel[part]) {
                currentLevel[part] = (index === pathParts.length - 1) ? [] : {};
            }
            currentLevel = currentLevel[part];
        });

        currentLevel.push(file);
    });

    customFiles.forEach(file => {
        const pathParts = file.relativePath.split('\\');
        let currentLevel = customFileTree;

        pathParts.forEach((part, index) => {
            if (!currentLevel[part]) {
                currentLevel[part] = (index === pathParts.length - 1) ? [] : {};
            }
            currentLevel = currentLevel[part];
        });

        currentLevel.push(file);
    });

    const sortTree = (tree: any) => {
        Object.keys(tree).forEach(key => {
            if (Array.isArray(tree[key])) {
                tree[key].sort((a: FileData, b: FileData) => naturalSort(a.fileName, b.fileName));
            } else {
                sortTree(tree[key]);
            }
        });
    };

    sortTree(globalFileTree);
    sortTree(customFileTree);

    flattenFileTree(globalFileTree);
    flattenFileTree(customFileTree);

    const createFileTree = (tree: any, depth: number = 0, customContent: boolean = false): DocumentFragment => {
        const fragment = document.createDocumentFragment();

        Object.keys(tree).sort(naturalSort).forEach(key => {
            const value = tree[key];
            const details = document.createElement('details');
            details.className = 'small-margin small-round';

            details.addEventListener('toggle', () => {
                if (details.open) {
                    summary.classList.add('primary');
                    summary.classList.remove('fill');
                } else {
                    summary.classList.remove('primary');
                    summary.classList.add('fill');
                }
            });

            const summary = document.createElement('summary');
            summary.className = 'none no-padding fill';

            const groupElement = document.createElement('a');
            groupElement.className = 'row wave padding small-round';

            const imgElement = document.createElement('i');
            const groupIcon = Array.isArray(value) ? "ri-book-shelf-line" : "ri-folder-fill";
            imgElement.className = groupIcon;
            groupElement.appendChild(imgElement);

            const divElement = document.createElement('div');
            divElement.className = 'max';

            const groupNameElement = document.createElement('p');
            groupNameElement.textContent = key;
            divElement.appendChild(groupNameElement);

            groupElement.appendChild(divElement);

            summary.appendChild(groupElement);
            details.appendChild(summary);

            const lazyLoadContainer = document.createElement('div'); // Placeholder for lazy loading
            details.appendChild(lazyLoadContainer);

            details.addEventListener('toggle', () => {
                if (details.open && !lazyLoadContainer.hasChildNodes()) {
                    if (Array.isArray(value)) {
                        const fileArticle = document.createElement('article');
                        fileArticle.className = 'group-content no-border no-round no-padding';
                        fileArticle.style.marginTop = '0px';

                        value.forEach((file: FileData) => {
                            if (customContent) {
                                const fileButton = getCustomFileButton(file);
                                fileArticle.appendChild(fileButton);
                            } else {
                                const fileButton = getFileButton(file);
                                fileArticle.appendChild(fileButton);
                            }
                            const divider = document.createElement('div');
                            divider.className = 'divider';
                            fileArticle.appendChild(divider);
                        });

                        lazyLoadContainer.appendChild(fileArticle);
                    } else {
                        lazyLoadContainer.appendChild(createFileTree(value, depth + 1));
                    }
                }
                updateFileSelectionVisuals();
            });
            fragment.appendChild(details);
        });
        return fragment;
    };

    const globalFileTreeFragment = createFileTree(globalFileTree, 0, false);
    globalFileListDiv.appendChild(globalFileTreeFragment);

    const customFileTreeFragment = createFileTree(customFileTree, 0, true);
    customFileListDiv.appendChild(customFileTreeFragment);

    const progressElement = document.querySelector('#progress-bar-container') as HTMLDivElement;
    if (progressElement) {
        progressElement.classList.add('hidden');
        progressElement.style.display = 'none';
    }
}

async function getAllFilesFromDB(db: IDBDatabase): Promise<FileData[]> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
            resolve(getAllRequest.result);
        };

        getAllRequest.onerror = () => {
            reject(getAllRequest.error);
        };
    });
}

function wrapInParagraphsWithSpans(htmlContent: string) {
    const sections = htmlContent.split('<br><br>');

    return sections.map(section => {
        const lines = section.split('<br>');
        const spanContent = lines.map(line => `<span>${line}</span>`).join('');

        if (lines.length > 2) {
            const id = lines[0].trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-');
            return `<p id="${id}">${spanContent}</p>`;
        } else {
            return spanContent; // Return the single line as is without <p> tags
        }
    }).join('');
}

async function displayFileContent(file: FileData) {
    try {
        currentParagraphIndex = 0;
        currentSongIndex = flattenedFileList.findIndex(song => song === file); // Set the current index
        const fileContentDiv = document.getElementById('file-content') as HTMLDivElement;
        const fileNameHeader = document.getElementById('file-name-header') as HTMLHeadingElement;
        if (file) {
            const formattedContent = file.fileContent.replace(/\n/g, '<br>');
            fileNameHeader.textContent = file.fileName.replace('.txt', '');
            fileContentDiv.innerHTML = wrapInParagraphsWithSpans(formattedContent);

            ui('#song');

            window.scrollTo({ top: 0, behavior: 'instant' });
            const songNav = document.getElementById('song-nav') as HTMLElement;
            const songsNav = document.getElementById('home-nav') as HTMLElement;

            songNav.style.display = 'block';
            songsNav.style.display = 'none';
            if (focusEnabled) {
                focusParagraph(0);
            }
            searchSongContents();
        } else {
            fileContentDiv.textContent = 'File not found in IndexedDB.';
        }
    } catch (error) {
        console.error("Error retrieving file from IndexedDB:", error);
    }
}

function updateIcon(mode: string) {
    const iconElements = document.querySelectorAll("#toggle-theme i");
    iconElements.forEach((iconElement) => {
        iconElement.textContent = mode === "dark" ? "light_mode" : "dark_mode";
    });
};

function updateFontSize(size: number) {
    const fileContentDiv = document.getElementById('file-content') as HTMLDivElement;
    fileContentDiv.style.fontSize = `${size}px`;
    localStorage.setItem('fontSize', size.toString());
}

function getFontSize(): number {
    return parseInt(localStorage.getItem('fontSize') || '16', 10);
}

function focusParagraph(index: number) {
    const paragraphs = document.querySelectorAll('#file-content p');
    paragraphs.forEach((p, i) => {
        if (i === index) {
            p.classList.add('active-paragraph');
            p.classList.add('blur-none');

            const rect = p.getBoundingClientRect();
            const offset = window.innerHeight / 2 - rect.height / 2;
            window.scrollTo({
                top: window.scrollY + rect.top - offset,
                behavior: 'smooth' // Scroll smoothly to the position
            });
        } else {
            p.classList.remove('active-paragraph');
            p.classList.remove('blur-none');
        }
    });

    const fileContent = document.getElementById('file-content');
    if (focusEnabled && fileContent) {
        fileContent.classList.add('blur');
    } else if (fileContent) {
        fileContent.classList.remove('blur');
    }
}

function showSuccessSnackbar(message: string) {
    const snackbar = document.getElementById('success-snackbar') as HTMLDivElement;
    snackbar.textContent = message;
    ui('#success-snackbar', 3000);
}

function showUpdateCompleteSnackbar(message: string) {
    const snackbar = document.getElementById('update-snackbar') as HTMLDivElement;
    const snackbarUpdate = snackbar.querySelector('#update-snackbar-update') as HTMLAnchorElement;
    snackbarUpdate.onclick = () => {
        window.location.reload();
    };
    const snackbarText = snackbar.querySelector('#update-snackbar-text') as HTMLDivElement;
    snackbarText.textContent = message;
    ui('#update-snackbar', 6000);
}

function showErrorSnackbar(message: string) {
    const snackbar = document.getElementById('error-snackbar') as HTMLDivElement;
    snackbar.textContent = message;
    ui('#error-snackbar', 6000);
}

function initializeFileContent() {
    const fileContentDiv = document.getElementById('file-content') as HTMLDivElement;
    fileContentDiv.style.fontSize = `${getFontSize()}px`;
    if (focusEnabled) {
        focusParagraph(0);
    }
}

function removeFocusFromAllParagraphs() {
    const paragraphs = document.querySelectorAll('#file-content p') as NodeListOf<HTMLParagraphElement>;
    paragraphs.forEach(p => {
        p.classList.remove('active-paragraph');
        p.classList.remove('blur');
        p.classList.remove('blur-none');
    });
}

function moveToPreviousParagraph() {
    const paragraphs = document.querySelectorAll('#file-content p') as NodeListOf<HTMLParagraphElement>;

    currentParagraphIndex--;
    if (currentParagraphIndex < 0) {
        currentParagraphIndex = paragraphs.length - 1;
    }
    focusParagraph(currentParagraphIndex);
}

function moveToNextParagraph() {
    const paragraphs = document.querySelectorAll('#file-content p') as NodeListOf<HTMLParagraphElement>;

    currentParagraphIndex++;
    if (currentParagraphIndex >= paragraphs.length) {
        currentParagraphIndex = 0;
    }
    focusParagraph(currentParagraphIndex);
}

async function moveToPreviousSong() {
    if (currentSongIndex > 0) {
        currentSongIndex--;
        const previousSong = flattenedFileList[currentSongIndex];
        displayFileContent(previousSong);
    }
}

async function moveToNextSong() {
    if (currentSongIndex < flattenedFileList.length - 1) {
        currentSongIndex++;
        const nextSong = flattenedFileList[currentSongIndex];
        displayFileContent(nextSong);
    }
}

function searchSongContents() {
    const inputBox = document.getElementById('search-song-content-input') as HTMLInputElement;
    const query = inputBox.value.trim();
    const fileContentDiv = document.getElementById('file-content') as HTMLDivElement;
    const helperSpan = document.querySelector('#search-song .helper') as HTMLElement;

    const paragraphs = fileContentDiv.querySelectorAll('p');
    let totalMatches = 0;

    paragraphs.forEach(paragraph => {
        const spans = paragraph.querySelectorAll('span');

        spans.forEach(span => {
            span.innerHTML = span.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1');

            if (query === '') {
                return;
            }

            const escapedQuery = escapeRegExp(query);
            const regex = new RegExp(`(${escapedQuery})`, 'gi');

            const matches = [...span.textContent!.matchAll(regex)];
            totalMatches += matches.length;

            if (matches.length > 0) {
                span.innerHTML = span.innerHTML.replace(regex, '<span class="highlight">$1</span>');
            }
        });
    });

    if (query === '') {
        helperSpan.textContent = ''; // Clear helper text if query is empty
    } else {
        helperSpan.textContent = `${totalMatches} result${totalMatches !== 1 ? 's' : ''} found`;
    }
}

async function hashChanged() {
    const tabs = document.querySelectorAll('.tabs a');
    const pages = document.querySelectorAll('.page');
    const songNav = document.getElementById('song-nav') as HTMLElement;
    const songsNav = document.getElementById('home-nav') as HTMLElement;
    const singAlongNav = document.getElementById('sing-along-nav') as HTMLElement;
    const urlParams = new URLSearchParams(window.location.search);
    const song = urlParams.get('song');
    const hash = window.location.hash;

    tabs.forEach(tab => {
        const ui = tab.getAttribute('data-ui');

        if (ui === hash) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    pages.forEach(page => {
        if (page.id === hash.substring(1)) {
            page.classList.add('active');
            if (hash === '#song') {
                if (songNav) {
                    songNav.style.display = 'block';
                    songsNav.style.display = 'none';
                    singAlongNav.style.display = 'none';
                }
            } else if (hash === '#home') {
                if (songsNav) {
                    songNav.style.display = 'none';
                    songsNav.style.display = 'block';
                    singAlongNav.style.display = 'none';
                }
            } else if (hash === '#sing-along-page') {
                if (singAlongNav) {
                    songNav.style.display = 'none';
                    songsNav.style.display = 'none';
                    singAlongNav.style.display = 'block';
                }
            }
        } else {
            page.classList.remove('active');
        }
    });

    if (hash === '#song') {
        const db = await initGlobalDB();
        if (song) {
            // await displayFileContent(song, db, false);
        }
    }
}

async function toggleFocus() {
    focusEnabled = !focusEnabled;
    if (focusEnabled) {
        focusParagraph(currentParagraphIndex);
    } else {
        removeFocusFromAllParagraphs();
        const fileContent = document.getElementById('file-content');
        if (fileContent) {
            fileContent.classList.remove('blur');
        }
    }
}

async function toggleTheme() {
    const currentMode = localStorage.getItem("mode") || "dark";
    if (currentMode === "light") {
        localStorage.setItem("mode", "dark");
        ui("mode", "dark");
        updateIcon("dark");
    } else {
        localStorage.setItem("mode", "light");
        ui("mode", "light");
        updateIcon("light");
    }
}

async function addFileToCustomDB(db: IDBDatabase, fileData: FileData) {
    return new Promise<void | undefined>((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.add(fileData);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const tabs = document.querySelectorAll('.tabs a');
    const songNav = document.getElementById('song-nav') as HTMLElement;
    const songsNav = document.getElementById('home-nav') as HTMLElement;
    const singAlongNav = document.getElementById('sing-along-nav') as HTMLElement;
    const selectSongsToggle = document.getElementById('select-songs-toggle') as HTMLInputElement;
    const clearSelectionButton = document.getElementById('clear-selection') as HTMLButtonElement;
    const customFolderList = document.getElementById('custom-folders-list') as HTMLDivElement;
    const installPWA = document.getElementById('install-pwa') as HTMLButtonElement;
    const installIcon = installPWA.querySelector('i') as HTMLElement;

    if (isMobileDevice()) {
        installIcon.textContent = `install_mobile`;
    } else {
        installIcon.textContent = `install_desktop`;
    }
    clearSelectionButton.style.display = 'none';

    const currentHash = window.location.hash;

    if (currentHash) {
        hashChanged();
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', (event) => {
            event.preventDefault();
            const targetPageId = tab.getAttribute('data-ui')!;
            const url = new URL(window.location.href);
            url.hash = targetPageId;

            window.history.pushState({}, '', url.toString());

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            if (targetPageId === '#song') {
                if (focusEnabled) {
                    focusParagraph(currentParagraphIndex);
                }
            }
            if (targetPageId === '#song') {
                if (songNav) {
                    songNav.style.display = 'block';
                    songsNav.style.display = 'none';
                    singAlongNav.style.display = 'none';
                }
            } else if (targetPageId === '#home') {
                if (songsNav) {
                    songNav.style.display = 'none';
                    songsNav.style.display = 'block';
                    singAlongNav.style.display = 'none';
                }
            } else if (targetPageId === '#sing-along-page') {
                if (singAlongNav) {
                    songNav.style.display = 'none';
                    songsNav.style.display = 'none';
                    singAlongNav.style.display = 'block';
                }
            }
        });
    });
    installPWA.addEventListener('click', async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
            installPWA.style.display = 'none';
        }
    });
    document.querySelector('#text-increase')?.addEventListener('click', () => {
        const newSize = getFontSize() + 1;
        updateFontSize(newSize);
    });
    document.querySelector('#text-decrease')?.addEventListener('click', () => {
        const newSize = Math.max(getFontSize() - 1, 10);
        updateFontSize(newSize);
    });
    document.querySelector('#nav-bar-open')?.addEventListener('click', () => {
        ui('#nav-bar');
    });
    document.querySelector('#nav-bar-close')?.addEventListener('click', () => {
        ui('#nav-bar');
    });
    document.querySelector('#close-collections-dialog-close')?.addEventListener('click', () => {
        ui('#custom-collections-dialog');
    });
    document.querySelector('#toggle-collections')?.addEventListener('click', async () => {
        customFolderList.innerHTML = '';
        const folders = getCustomFoldersFromLocalStorage();
        const folderNames = folders.map(folder => folder.folderName);

        publicFolders.forEach(folder => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'field middle-align';

            const nav = document.createElement('nav');

            const maxDiv = document.createElement('div');
            maxDiv.className = 'max';

            const title = document.createElement('h6');
            title.className = 'small';
            title.textContent = folder;

            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            if (folderNames.includes(folder)) {
                checkbox.checked = true;
            }
            checkbox.addEventListener('change', async () => {
                if (checkbox.checked) {
                    addFolderToCustomFolders(folder, false);
                } else {
                    removeFolderFromCustomFolders(folder);
                }
            });

            const span = document.createElement('span');

            switchLabel.appendChild(checkbox);
            switchLabel.appendChild(span);
            maxDiv.appendChild(title);
            nav.appendChild(maxDiv);
            nav.appendChild(switchLabel);
            fieldDiv.appendChild(nav);

            customFolderList.appendChild(fieldDiv);
        });

        ui('#custom-collections-dialog');
    });
    document.querySelector('#close-collections-dialog-apply')?.addEventListener('click', async () => {
        showSuccessSnackbar('Loading...');

        const customFolders = getCustomFoldersFromLocalStorage();
        const selectedFolders = customFolders.map(folder => folder.folderName);

        const [globalDB, customDB] = await Promise.all([
            initGlobalDB(),
            initCustomCollectionDB(),
        ]);

        cleanUpCustomDB(selectedFolders, customDB);

        customDBFiles = await fetchCustomCollectionFiles(customDB, customFolders),

        await renderFileList(globalDBFiles, globalDB, customDBFiles, customDB);

        showSuccessSnackbar('Collections updated successfully.');
    });

    document.querySelector('#add-group')?.addEventListener('click', () => {
        const selectedFilesList = document.getElementById('selected-songs-list') as HTMLElement;
        let count = 1;
        selectedFilesList.innerHTML = '';

        selectedFiles.forEach(fileName => {
            const fileButton = document.createElement('a');
            fileButton.className = 'file-item padding no-round wave wrap';
            fileButton.textContent = count++ + '. ' + fileName.replace('.txt', '');
            selectedFilesList.appendChild(fileButton);
        });
        ui('#add-song-dialog');
    });
    document.querySelector('#add-group-dialog-submit')?.addEventListener('click', async () => {
        const folderInput = document.getElementById('folder-name-input') as HTMLInputElement;
        const checkBoxInput = document.getElementById('folder-is-private-checkbox') as HTMLInputElement;
        const isPrivate = checkBoxInput.checked;
        const folderName = folderInput.value.trim().replace("/", "\\");
        const filesToUpload: FileData[] = [];
        const adminAccess = true;

        const [globalDB, customDB] = await Promise.all([
            initGlobalDB(),
            initCustomCollectionDB(),
        ]);

        [globalDBFiles, customDBFiles] = await Promise.all([
            getAllFilesFromDB(globalDB),
            getAllFilesFromDB(customDB),
        ]);

        for (const file of globalDBFiles) {
            if (selectedFiles.has(file.fileName)) {
                filesToUpload.push(file);
            }
        }
        if (selectedFiles.size <= 0){
            showErrorSnackbar('No files selected.');
            return;
        }

        const files = await Promise.all(
            filesToUpload.map(async (file) => {
                return {
                    fileName: file.fileName,
                    fileContent: file.fileContent,
                };
            })
        );

        const data = {
            folderName,
            isPrivate,
            files,
        };


        try {
            const response = await fetch('/api/files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                showErrorSnackbar('Error uploading files: ' + response.statusText);
            }

            const text = await response.text();
            const result = text ? JSON.parse(text) : {};

            if (result.status === 'success') {
                for (const file of filesToUpload) {
                    storeFilesinDB([{
                        fileName: file.fileName,
                        fileContent: file.fileContent,
                        relativePath: folderName,
                        isPrivate: isPrivate,
                    }], customDB);
                }
                addFolderToCustomFolders(folderName, adminAccess);
                const customFolders = getCustomFoldersFromLocalStorage();

                customDBFiles = await fetchCustomCollectionFiles(customDB, customFolders),
                publicFolders = await fetchAllPublicFolders();

                await renderFileList(globalDBFiles, globalDB, customDBFiles, customDB);

                showSuccessSnackbar('Files successfully added to custom collections.')
            } else {
                showErrorSnackbar(result.message || 'Unknown error');
            }
        } catch (error) {
            console.error(error);
            showErrorSnackbar('Error sending request: ' + error);
        }
    });
    document.querySelector('#sing-along-join')?.addEventListener('click', async () => {
        showSuccessSnackbar("Coming soon...");
    });
    document.querySelector('#add-group-dialog-close')?.addEventListener('click', () => {
        ui('#add-song-dialog');
    });
    selectSongsToggle.addEventListener('change', async () => {
        isSelectableMode = selectSongsToggle.checked;
        if (isSelectableMode) {
            clearSelectionButton.style.display = 'block';
        } else {
            clearSelectionButton.style.display = 'none';
        }
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(fileButton => {
            const fileName = fileButton.getAttribute('data-file-name');
            if (isSelectableMode) {
                fileButton.classList.add('selectable');
                if (fileName && selectedFiles.has(fileName)) {
                    fileButton.classList.add('selected');
                }
            } else {
                fileButton.classList.remove('selectable');
                fileButton.classList.remove('selected');
            }
        });
    });
    clearSelectionButton.addEventListener('click', async () => {
        selectedFiles.clear();
        updateFileSelectionVisuals();
    });
    document.querySelector('#paragraph-focus')?.addEventListener('click', toggleFocus);
    document.querySelector('#previous-paragraph')?.addEventListener('click', moveToPreviousParagraph);
    document.querySelector('#next-paragraph')?.addEventListener('click', moveToNextParagraph);
    document.querySelector('#toggle-theme')?.addEventListener('click', toggleTheme);
    document.querySelector('#previous-song')?.addEventListener('click', moveToPreviousSong);
    document.querySelector('#next-song')?.addEventListener('click', moveToNextSong);
    document.querySelector('#song')?.addEventListener('dblclick', (event) => {
        const mouseEvent = event as MouseEvent; // Explicitly cast the event to MouseEvent
        const songsPage = mouseEvent.currentTarget as HTMLElement;
        const pageWidth = songsPage.offsetWidth;
        const clickX = mouseEvent.clientX;

        if (clickX < pageWidth / 2) {
            moveToPreviousParagraph();
        } else {
            moveToNextParagraph();
        }
    });
    document.getElementById('search-song-content-input')?.addEventListener('input', async function () {
        searchSongContents();
    });
    document.getElementById('search-songs-input')?.addEventListener('input', async function () {
        const query = (this as HTMLInputElement).value.trim();
        if (query === '') {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            (async () => {
                filterSongs(query);
            })();
            return;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = window.setTimeout(async () => {
            filterSongs(query);
        }, 300);
    });
    initializeFileContent();
});

async function init() {
    try {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/serviceWorker.js', { scope: '/' });
                console.log('ServiceWorker registration successful with scope: /');

                if (navigator.onLine) {
                    const response = await fetch('/version');
                    const data = await response.json();
                    const currentVersion = localStorage.getItem('latestVersion');

                    if (currentVersion !== data.version) {
                        navigator.serviceWorker.addEventListener('message', event => {
                            if (event.data.action === 'cacheUpdated') {
                                setTimeout(() => {
                                    showUpdateCompleteSnackbar(`Update available: v${data.version}`);
                                }, 5000);
                            }
                        });

                        if (registration.active) {
                            registration.active.postMessage({ action: 'newUpdateCache' });
                            console.log('New version detected, updating cache...');
                        }
                        localStorage.setItem('latestVersion', data.version);
                    }else{
                        if (registration.active) {
                            registration.active.postMessage({ action: 'updateCache' });
                            console.log('Version check passed, updating cache...');
                        }
                    }
                } else {
                    console.log('Offline: Skipping version check');
                }
            } catch (error) {
                console.log('ServiceWorker registration failed: ', error);
            }
        }
        const VERSION = localStorage.getItem('latestVersion') || '1.0.0';
        const appNameVersion = document.getElementById('app-name-version') as HTMLHeadingElement;
        appNameVersion.textContent = `Hutterite Bookshelf v${VERSION}`;

        // Initialize databases and fetch data
        const customFolders = getCustomFoldersFromLocalStorage();
        const [globalDB, customDB] = await Promise.all([
            initGlobalDB(),
            initCustomCollectionDB(),
        ]);

        [globalDBFiles, customDBFiles, publicFolders] = await Promise.all([
            getAllFilesFromDB(globalDB),
            getAllFilesFromDB(customDB),
            fetchAllPublicFolders(),
        ]);

        if (globalDBFiles.length > 0 || customDBFiles.length > 0) {
            requestAnimationFrame(() => {
                renderFileList(globalDBFiles, globalDB, customDBFiles, customDB);
            });
        }

        if (navigator.onLine) {
            const [newGlobalFiles, newCustomFiles] = await Promise.all([
                fetchGlobalFiles(globalDB),
                fetchCustomCollectionFiles(customDB, customFolders),
            ]);

            if (globalDBFiles.length <= 0) {
                requestAnimationFrame(() => {
                    renderFileList(newGlobalFiles, globalDB, newCustomFiles, customDB);
                    globalDBFiles = newGlobalFiles;
                    customDBFiles = newCustomFiles;
                });
            }
            console.log("Updated indexedDB files from server.");
        } else if (globalDBFiles.length === 0) {
            console.log("No internet connection and no data in IndexedDB.");
        }
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

async function initializeUIAndStartApp() {
    try {
        let savedMode = localStorage.getItem("mode") || "dark";
        await ui("mode", savedMode);
        updateIcon(savedMode);
        await init();
    } catch (error) {
        console.error("Error during UI initialization:", error);
    }
}

window.addEventListener('load', initializeUIAndStartApp);
window.addEventListener('popstate', hashChanged);
