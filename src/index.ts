import 'beercss';
import 'material-dynamic-colors';
import 'remixicon/fonts/remixicon.css';
import '../static/css/style.css';
import '../static/css/theme.css';

interface FileData {
    fileName: string;
    relativePath: string;
    fileContent: string;
}
let selectedFiles = new Set<string>();
let indexDBFiles: FileData[] = []
let currentParagraphIndex = 0;
let focusEnabled = false;
let flattenedFileList: FileData[] = [];
let currentSongIndex = -1;
let debounceTimer: number | null = null; // For filtering songs
let isSelectableMode = false;
const LONG_PRESS_DURATION = 500; // Duration in milliseconds to consider a long press
let longPressTimer: number | null = null;


function escapeRegExp(string: string): string {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

async function initIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FileStorage', 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: 'fileName' });
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

async function storeFilesInIndexedDB(files: FileData[], db: IDBDatabase) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');

        files.forEach(file => {
            store.put(file);
        });

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
    });
}

async function fetchFiles(db: IDBDatabase): Promise<FileData[]> {
    const response = await fetch('/api/files');
    const files: FileData[] = await response.json();

    try {
        await storeFilesInIndexedDB(files, db);
    } catch (error) {
        console.error("Error storing files in IndexedDB:", error);
    }

    return files;
}

async function getFileFromIndexedDB(fileName: string, db: IDBDatabase): Promise<FileData | undefined> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const getRequest = store.get(fileName);

        getRequest.onsuccess = () => {
            resolve(getRequest.result);
        };

        getRequest.onerror = () => {
            reject(getRequest.error);
        };
    });
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
                flattenedFileList.push(file); // Store the full path or fileName
            });
        } else {
            flattenFileTree(value, currentPath);
        }
    });
}

async function filterSongs(query: string, db: IDBDatabase) {
    const helperText = document.querySelector('#search-songs .helper') as HTMLElement;

    if (query === '') {
        renderFileList(indexDBFiles, db);
        helperText.textContent = ''; // Clear the helper text when there's no query
        return;
    }
    const filteredFiles: FileData[] = indexDBFiles.filter(file =>
        file.fileName.toLowerCase().includes(query.toLowerCase())
    );

    helperText.textContent = `${filteredFiles.length} result${filteredFiles.length !== 1 ? 's' : ''} found`;

    renderFilteredFileList(filteredFiles, db, query);
}

async function updateFileSelectionVisuals() {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const fileName = item.getAttribute('data-file-name');
        if (isSelectableMode) {
            item.classList.add('selectable');
        } else {
            item.classList.remove('selectable');
        }

        if (fileName && selectedFiles.has(fileName)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function getFileButton(file: FileData, db: IDBDatabase, showText: boolean = true): HTMLElement {
    const fileButton = document.createElement('a');
    fileButton.className = 'file-item padding surface-container no-round wave wrap';
    if (showText) {
        fileButton.textContent = file.fileName.replace('.txt', '');
    }
    fileButton.setAttribute('data-file-name', file.fileName);

    if (selectedFiles.has(file.fileName)) {
        fileButton.classList.add('selected');
    }

    fileButton.addEventListener('mousedown', () => {
        longPressTimer = window.setTimeout(() => {
            const selectSongsToggle = document.getElementById('select-songs-toggle') as HTMLInputElement;
            selectSongsToggle.checked = !selectSongsToggle.checked;
            const event = new Event('change');
            selectSongsToggle.dispatchEvent(event);
        }, LONG_PRESS_DURATION);
    });

    fileButton.addEventListener('mouseup', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    fileButton.addEventListener('mouseleave', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    fileButton.addEventListener('click', (event) => {
        if (isSelectableMode) {
            event.preventDefault();
            fileButton.classList.toggle('selected');
            if (fileButton.classList.contains('selected')) {
                selectedFiles.add(file.fileName);
            } else {
                selectedFiles.delete(file.fileName);
            }
        } else {
            displayFileContent(file.fileName, db);
        }
    });
    return fileButton;
}

async function renderFilteredFileList(files: FileData[], db: IDBDatabase, query: string) {
    const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
    fileListDiv.innerHTML = '';
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
        const fileButton = getFileButton(file, db, false);
        fileButton.className = 'padding wave file-item wrap no-round';
        const textContainer = document.createElement('div');
        textContainer.className = 'max';

        const headline = document.createElement('h6');
        headline.className = 'small';
        headline.textContent = file.fileName.replace('.txt', '');
        const escapedQuery = escapeRegExp(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        headline.innerHTML = headline.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/gi, '$1');
        headline.innerHTML = headline.textContent!.replace(regex, '<span class="highlight">$1</span>');
        textContainer.appendChild(headline);

        const supportingText = document.createElement('div');
        supportingText.textContent = file.relativePath; // Display the relative path as supporting text
        textContainer.appendChild(supportingText);

        fileButton.appendChild(textContainer);

        fragment.appendChild(fileButton);

        const divider = document.createElement('div');
        divider.className = 'divider';
        fragment.appendChild(divider);
    });

    content.appendChild(fragment);
    fileListDiv.appendChild(content);
    updateFileSelectionVisuals();
}

async function renderFileList(files: FileData[], db: IDBDatabase) {
    const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
    fileListDiv.innerHTML = '';

    flattenedFileList = [];
    const fileTree: { [key: string]: any } = {};

    const naturalSort = (a: string, b: string) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    files.forEach(file => {
        const pathParts = file.relativePath.split('\\');
        let currentLevel = fileTree;

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

    sortTree(fileTree);
    flattenFileTree(fileTree);

    const createFileTree = (tree: any, depth: number = 0): DocumentFragment => {
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
                            const fileButton = getFileButton(file, db);
                            fileArticle.appendChild(fileButton);
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

    const fileTreeFragment = createFileTree(fileTree);
    fileListDiv.appendChild(fileTreeFragment);

    const progressElement = document.querySelector('#song-progress-bar') as HTMLProgressElement;
    if (progressElement) {
        progressElement.classList.add('hidden');
        progressElement.style.display = 'none';
    }
}

async function getAllFilesFromIndexedDB(db: IDBDatabase): Promise<FileData[]> {
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

async function displayFileContent(fileName: string, db: IDBDatabase, updateUrl: boolean = true) {
    try {
        currentParagraphIndex = 0;
        currentSongIndex = flattenedFileList.findIndex(song => song.fileName === fileName); // Set the current index
        const file = await getFileFromIndexedDB(fileName, db);
        const fileContentDiv = document.getElementById('file-content') as HTMLDivElement;
        const fileNameHeader = document.getElementById('file-name-header') as HTMLHeadingElement;
        if (file) {
            const formattedContent = file.fileContent.replace(/\n/g, '<br>');
            fileNameHeader.textContent = file.fileName.replace('.txt', '');
            fileContentDiv.innerHTML = wrapInParagraphsWithSpans(formattedContent);

            ui('#song');

            if (updateUrl) {
                const url = new URL(window.location.href);
                url.searchParams.set('song', file.fileName);
                url.hash = '#song';
                window.history.pushState({}, '', url.toString());
            }

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
    const iconElements = document.querySelectorAll("#toggle_theme i");
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
        const db = await initIndexedDB();
        currentSongIndex--;
        const previousSong = flattenedFileList[currentSongIndex];
        displayFileContent(previousSong.fileName, db);
    }
}

async function moveToNextSong() {
    if (currentSongIndex < flattenedFileList.length - 1) {
        const db = await initIndexedDB();
        currentSongIndex++;
        const nextSong = flattenedFileList[currentSongIndex];
        displayFileContent(nextSong.fileName, db);
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
        const db = await initIndexedDB();
        if (song) {
            await displayFileContent(song, db, false);
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

document.addEventListener('DOMContentLoaded', async () => {
    const tabs = document.querySelectorAll('.tabs a');
    const songNav = document.getElementById('song-nav') as HTMLElement;
    const songsNav = document.getElementById('home-nav') as HTMLElement;
    const singAlongNav = document.getElementById('sing-along-nav') as HTMLElement;
    const selectSongsToggle = document.getElementById('select-songs-toggle') as HTMLInputElement;
    const clearSelectionButton = document.getElementById('clear-selection') as HTMLButtonElement;
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
            console.log(targetPageId);

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


    document.querySelector('#text_increase')?.addEventListener('click', () => {
        const newSize = getFontSize() + 1;
        updateFontSize(newSize);
    });
    document.querySelector('#text_decrease')?.addEventListener('click', () => {
        const newSize = Math.max(getFontSize() - 1, 10);
        updateFontSize(newSize);
    });
    document.querySelector('#nav-bar-open')?.addEventListener('click', () => {
        ui('#nav-bar');
    });
    document.querySelector('#nav-bar-close')?.addEventListener('click', () => {
        ui('#nav-bar');
    });
    document.querySelector('#add-group')?.addEventListener('click', () => {
        ui('#add-song-dialog');
    });
    document.querySelector('#add-group-dialog-submit')?.addEventListener('click', async () => {
        const folderInput = document.getElementById('folder-name-input') as HTMLInputElement;
        const checkBoxInput = document.getElementById('folder-is-private-checkbox') as HTMLInputElement;
        const isPrivate = checkBoxInput.checked;
        const folderName = folderInput.value.trim();
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
    document.querySelector('#toggle_theme')?.addEventListener('click', toggleTheme);
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
                const db = await initIndexedDB();
                filterSongs(query, db);
            })();
            return;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = window.setTimeout(async () => {
            const db = await initIndexedDB();
            filterSongs(query, db);
        }, 300);
    });
    initializeFileContent();
});

async function init() {
    try {
        const db = await initIndexedDB();
        indexDBFiles = await getAllFilesFromIndexedDB(db);

        if (indexDBFiles.length > 0) {
            requestAnimationFrame(() => {
                renderFileList(indexDBFiles, db);
            });
        }

        if (navigator.onLine) {
            const newFiles = await fetchFiles(db);
            if (indexDBFiles.length <= 0) {
                requestAnimationFrame(() => {
                    renderFileList(newFiles, db);
                });
            }
            console.log("Updated indexedDB files from server.");
        } else if (indexDBFiles.length === 0) {
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