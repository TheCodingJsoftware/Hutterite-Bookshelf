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
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface FolderData {
    folderName: string;
    adminAccess: boolean;
}

interface SingAlongData {
    action: string;
    [key: string]: any;
}

let selectedFiles = new Set<string>();
let globalDBFiles: FileData[] = []
let customDBFiles: FileData[] = []
let isSelectableMode = false;
let publicFolders: string[] = [];
const LONG_PRESS_DURATION = 500; // Duration in milliseconds to consider a long press
let longPressTimer: number | null = null;
let deferredPrompt: BeforeInstallPromptEvent | null = null;

let homePage: HomePage;
let songPage: SongPage;
let singAlongPage: SingAlongPage;

class SongContainer {
    containerID: string;
    container: HTMLDivElement;
    searchSongInput: HTMLInputElement;
    header: HTMLHeadingElement
    content: HTMLDivElement;
    paragraphs: NodeListOf<HTMLParagraphElement>;
    currentParagraphIndex: number;
    focusEnabled: boolean;

    constructor(contaierID: string) {
        this.containerID = contaierID;
        this.container = document.getElementById(this.containerID) as HTMLDivElement;
        this.searchSongInput = this.container.querySelector("#search-song-content-input") as HTMLInputElement;
        this.header = this.container.querySelector("#file-name-header") as HTMLHeadingElement;
        this.content = this.container.querySelector("#file-content") as HTMLDivElement;
        this.paragraphs = [] as unknown as NodeListOf<HTMLParagraphElement>;
        this.currentParagraphIndex = 0;
        this.focusEnabled = false;
        this.updateFontSize();
        this.initialize();
    }

    initialize() {
        this.searchSongInput.addEventListener('input', () => {
            this.searchSongContents();
        });

        this.container.addEventListener('dblclick', (event) => {
            const mouseEvent = event as MouseEvent;
            const songsPage = mouseEvent.currentTarget as HTMLElement;
            const pageWidth = songsPage.offsetWidth;
            const clickX = mouseEvent.clientX;

            if (clickX < pageWidth / 2) {
                this.moveToPreviousParagraph();
            } else {
                this.moveToNextParagraph();
            }
        });
    }

    wrapInParagraphsWithSpans(htmlContent: string) {
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

    searchSongContents() {
        const query = this.searchSongInput.value.trim();
        const helperSpan = this.container.querySelector('#search-song .helper') as HTMLElement;

        let totalMatches = 0;

        this.paragraphs.forEach(paragraph => {
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
            helperSpan.textContent = '';
        } else {
            helperSpan.textContent = `${totalMatches} result${totalMatches !== 1 ? 's' : ''} found`;
        }
    }

    updateFontSize() {
        this.content.style.fontSize = `${getFontSize()}px`;
    }

    toggleParagraphFocus() {
        this.focusEnabled = !this.focusEnabled;
        if (this.focusEnabled) {
            this.focusParagraph(this.currentParagraphIndex);
        } else {
            this.removeFocusFromAllParagraphs();
            if (this.content) {
                this.content.classList.remove('blur');
            }
        }
    }

    removeFocusFromAllParagraphs() {
        this.paragraphs.forEach(paragraph => {
            paragraph.classList.remove('active-paragraph');
            paragraph.classList.remove('blur');
            paragraph.classList.remove('blur-none');
        });
    }

    focusParagraph(index?: number) {
        if (index === undefined) {
            index = this.currentParagraphIndex;
        }
        this.paragraphs.forEach((paragraph, i) => {
            if (i === index) {
                paragraph.classList.add('active-paragraph');
                paragraph.classList.add('blur-none');

                const rect = paragraph.getBoundingClientRect();
                const offset = window.innerHeight / 2 - rect.height / 2;
                window.scrollTo({
                    top: window.scrollY + rect.top - offset,
                    behavior: 'smooth' // Scroll smoothly to the position
                });
            } else {
                paragraph.classList.remove('active-paragraph');
                paragraph.classList.remove('blur-none');
            }
        });

        if (this.focusEnabled && this.content) {
            this.content.classList.add('blur');
        } else if (this.content) {
            this.content.classList.remove('blur');
        }
    }

    moveToPreviousParagraph() {
        this.currentParagraphIndex--;
        if (this.currentParagraphIndex < 0) {
            this.currentParagraphIndex = this.paragraphs.length - 1;
        }
        this.focusParagraph(this.currentParagraphIndex);
    }

    moveToNextParagraph() {
        this.currentParagraphIndex++;
        if (this.currentParagraphIndex >= this.paragraphs.length) {
            this.currentParagraphIndex = 0;
        }
        this.focusParagraph(this.currentParagraphIndex);
    }

    displaySong(file: FileData) {
        const formattedContent = file.fileContent.replace(/\n/g, '<br>');
        this.header.textContent = file.fileName.replace('.txt', '');
        this.content.innerHTML = this.wrapInParagraphsWithSpans(formattedContent);
        this.paragraphs = this.content.querySelectorAll('p');
    }

    hide() {
        this.container.style.display = 'none';
    }

    show() {
        this.container.style.display = 'block';
    }
}

class HomePage {
    pageID: string;
    navBarID: string;
    songPage?: SongPage;
    singAlongPage?: SingAlongPage;
    debounceTimer?: number; // For filtering songs
    DB?: IDBDatabase;
    customCollectionsDB?: IDBDatabase;
    allDBFiles: FileData[];
    allCustomCollectionDBFiles: FileData[];
    flattendFileList: FileData[];
    publicFolders: string[];
    container: HTMLDivElement;
    navBar: HTMLDialogElement;
    searchSongsInput: HTMLInputElement;
    fileList: HTMLDivElement;
    customCollectionsContainer: HTMLDivElement;
    customCollectionsFileList: HTMLDivElement;
    openCreateSongDialogButton: HTMLButtonElement;
    selectSongsToggle: HTMLInputElement;
    clearSelections: HTMLButtonElement;
    addSongsSubmitButton: HTMLButtonElement;
    addSongsCloseButton: HTMLButtonElement;
    addSongsFolderName: HTMLInputElement;
    addSongsFolderIsPrivate: HTMLInputElement;
    createSongFolderName: HTMLInputElement;
    createSongFolderIsPrivate: HTMLInputElement;
    createSongDialog: HTMLDialogElement;
    createSongName: HTMLInputElement;
    createSongContents: HTMLTextAreaElement;
    createSongSubmitButton: HTMLButtonElement;
    createSongCloseButton: HTMLButtonElement;
    addSongsDialog: HTMLDialogElement;
    isSelectionMode: boolean;
    selectedFiles: Set<string>;

    constructor(pageID: string, navBarID: string) {
        this.pageID = pageID;
        this.navBarID = navBarID;

        this.debounceTimer = undefined;
        this.DB = undefined;
        this.customCollectionsDB = undefined;
        this.allDBFiles = [];
        this.allCustomCollectionDBFiles = [];
        this.flattendFileList = [];
        this.publicFolders = [];
        this.isSelectionMode = false;
        this.selectedFiles = new Set<string>();

        this.container = document.getElementById(this.pageID) as HTMLDivElement;
        this.navBar = document.getElementById(this.navBarID) as HTMLDialogElement;
        this.searchSongsInput = this.container.querySelector("#search-songs-input") as HTMLInputElement;
        this.fileList = this.container.querySelector("#file-list") as HTMLDivElement;
        this.customCollectionsContainer = this.container.querySelector("#custom-collections-container") as HTMLDivElement;
        this.customCollectionsContainer.style.display = 'none';
        this.customCollectionsFileList = this.customCollectionsContainer.querySelector("#custom-collections-file-list") as HTMLDivElement;

        this.createSongDialog = document.getElementById('create-song-dialog') as HTMLDialogElement;
        this.addSongsDialog = document.getElementById('add-song-dialog') as HTMLDialogElement;

        this.selectSongsToggle = this.navBar.querySelector("#select-songs-toggle") as HTMLInputElement;
        this.clearSelections = this.navBar.querySelector("#clear-selection") as HTMLButtonElement;
        this.clearSelections.style.display = 'none';
        this.openCreateSongDialogButton = this.navBar.querySelector("#add-group") as HTMLButtonElement;

        this.createSongSubmitButton = this.createSongDialog.querySelector('#create-group-dialog-submit') as HTMLButtonElement;
        this.createSongCloseButton = this.createSongDialog.querySelector('#create-group-dialog-close') as HTMLButtonElement;
        this.createSongName = this.createSongDialog.querySelector('#folder-name-input') as HTMLInputElement;
        this.createSongContents = this.createSongDialog.querySelector('#song-contents-input') as HTMLTextAreaElement;
        this.createSongFolderName = this.createSongDialog.querySelector('#create-song-folder-name-input') as HTMLInputElement;
        this.createSongFolderIsPrivate = this.createSongDialog.querySelector('#create-song-folder-is-private') as HTMLInputElement;
        this.addSongsFolderIsPrivate = this.addSongsDialog.querySelector('#add-song-folder-is-private') as HTMLInputElement;
        this.addSongsFolderName = this.addSongsDialog.querySelector('#add-song-folder-name-input') as HTMLInputElement;
        this.addSongsSubmitButton = this.addSongsDialog.querySelector('#add-group-dialog-submit') as HTMLButtonElement;
        this.addSongsCloseButton = this.addSongsDialog.querySelector('#add-group-dialog-close') as HTMLButtonElement;

        this.initialize();
    }

    async initialize() {
        [this.DB, this.customCollectionsDB] = await Promise.all([
            this.initGlobalDB(),
            this.initCustomCollectionDB(),
        ]);


        [this.allDBFiles, this.allCustomCollectionDBFiles] = await Promise.all([
            this.getAllFilesFromDB(this.DB),
            this.getAllFilesFromDB(this.customCollectionsDB),
        ]);

        this.publicFolders = await this.fetchAllPublicFolders();

        if (this.allDBFiles.length > 0 || this.allCustomCollectionDBFiles.length > 0) {
            requestAnimationFrame(() => {
                this.renderFileList();
            });
        }

        if (navigator.onLine) {
            const [newGlobalFiles, newCustomFiles] = await Promise.all([
                this.fetchGlobalFiles(),
                this.fetchCustomCollectionFiles(),
            ]);

            if (this.allDBFiles.length <= 0) {
                requestAnimationFrame(() => {
                    this.allDBFiles = newGlobalFiles;
                    this.allCustomCollectionDBFiles = newCustomFiles;
                    this.renderFileList();
                });
            }
            console.log("Updated indexedDB files from server.");
        } else if (this.allDBFiles.length === 0) {
            console.log("No internet connection and no data in IndexedDB.");
        }

        this.searchSongsInput.addEventListener('input', () => {
            const query = this.searchSongsInput.value.trim();
            if (query === '') {
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = undefined;
                }
                this.filterSongs(query);
                return;
            }

            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = window.setTimeout(() => {
                this.filterSongs(query);
            }, 300);
        });
        this.selectSongsToggle.addEventListener('change', async () => {
            this.isSelectionMode = this.selectSongsToggle.checked;
            if (this.isSelectionMode) {
                this.clearSelections.style.display = 'block';
            } else {
                this.clearSelections.style.display = 'none';
            }
            const fileItems = this.container.querySelectorAll('.file-item');
            fileItems.forEach(fileButton => {
                const fileName = fileButton.getAttribute('data-file-name');
                if (this.isSelectionMode) {
                    fileButton.classList.add('selectable');
                    if (fileName && this.selectedFiles.has(fileName)) {
                        fileButton.classList.add('selected');
                    }
                } else {
                    fileButton.classList.remove('selectable');
                    fileButton.classList.remove('selected');
                }
            });
        });
        this.clearSelections.addEventListener('click', async () => {
            this.selectedFiles.clear();
            this.updateFileSelectionVisuals();
        });
        this.addSongsCloseButton.addEventListener('click', () => {
            ui('#add-song-dialog');
        });
        this.createSongCloseButton.addEventListener('click', () => {
            ui('#create-song-dialog');
        });
        this.addSongsSubmitButton.addEventListener('click', async () => {
            const isPrivate = this.addSongsFolderIsPrivate.checked;
            const folderName = this.addSongsFolderName.value.trim().replace("/", "\\");
            const filesToUpload: FileData[] = [];
            const adminAccess = true;

            for (const file of this.allDBFiles) {
                if (selectedFiles.has(file.fileName)) {
                    filesToUpload.push(file);
                }
            }
            if (selectedFiles.size <= 0) {
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
                        this.storeFilesinDB([{
                            fileName: file.fileName,
                            fileContent: file.fileContent,
                            relativePath: folderName,
                            isPrivate: isPrivate,
                        }]);
                    }
                    addFolderToCustomFolders(folderName, adminAccess);
                    const customFolders = this.getCustomFoldersFromLocalStorage();

                    [this.allCustomCollectionDBFiles, this.publicFolders] = await Promise.all([
                        this.fetchCustomCollectionFiles(),
                        this.fetchAllPublicFolders()
                    ]);

                    await this.renderFileList();

                    showSuccessSnackbar('Files successfully added to custom collections.')
                } else {
                    showErrorSnackbar(result.message || 'Unknown error');
                }
            } catch (error) {
                console.error(error);
                showErrorSnackbar('Error sending request: ' + error);
            }
        });
        this.createSongSubmitButton.addEventListener('click', async () => {
            const isPrivate = this.createSongFolderIsPrivate.checked;
            const folderName = this.createSongFolderName.value.trim().replace("/", "\\");
            const songName = this.createSongName.value.trim();
            const contents = this.createSongContents.value.trim();
            const adminAccess = true;

            if (folderName === '' || songName === '' || contents === '') {
                showErrorSnackbar('All fields are required.');
                return;
            }
            const newFile: FileData = {
                fileName: songName,
                fileContent: contents,
                relativePath: folderName,
                isPrivate,
            };
            const data = {
                folderName,
                isPrivate,
                files: [newFile],
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
                    this.storeFilesinDB([newFile]);
                    this.addFolderToCustomFolders(folderName, adminAccess);

                    [this.allCustomCollectionDBFiles, this.publicFolders] = await Promise.all([
                        this.fetchCustomCollectionFiles(),
                        this.fetchAllPublicFolders(),
                    ]);

                    await this.renderFileList();

                    showSuccessSnackbar('Files successfully added to custom collections.')
                } else {
                    showErrorSnackbar(result.message || 'Unknown error');
                }
            } catch (error) {
                console.error(error);
                showErrorSnackbar('Error sending request: ' + error);
            }
            ui('#create-song-dialog');
        });
        this.openCreateSongDialogButton.addEventListener('click', () => {
            if (this.selectedFiles.size <= 0) {
                ui('#create-song-dialog');
            }else{
                const selectedFilesList = this.addSongsDialog.querySelector('#selected-songs-list') as HTMLElement;
                let count = 1;
                selectedFilesList.innerHTML = '';

                selectedFiles.forEach(fileName => {
                    const fileButton = document.createElement('a');
                    fileButton.className = 'file-item padding no-round wave wrap';
                    fileButton.textContent = count++ + '. ' + fileName.replace('.txt', '');
                    selectedFilesList.appendChild(fileButton);
                });
                ui('#add-song-dialog');
            }
        });

    }

    setReferences(songPage: SongPage, singAlongPage: SingAlongPage) {
        this.songPage = songPage;
        this.singAlongPage = singAlongPage;
    }

    filterSongs(query: string) {
        const helperText = document.querySelector('#search-songs .helper') as HTMLElement;
        if (query === '') {
            this.renderFileList();
            helperText.textContent = '';
            return;
        }
        let filteredFiles: FileData[] = this.allDBFiles.filter(file =>
            file.fileName.toLowerCase().includes(query.toLowerCase())
        );
        filteredFiles = filteredFiles.concat(this.allCustomCollectionDBFiles.filter(file =>
            file.fileName.toLowerCase().includes(query.toLowerCase())
        ));
        helperText.textContent = `${filteredFiles.length} result${filteredFiles.length !== 1 ? 's' : ''} found`;
        this.renderFilteredFileList(filteredFiles, query);
    }

    renderFilteredFileList(files: FileData[], query: string) {
        this.fileList.innerHTML = '';
        const customContent = document.getElementById('custom-collections-container') as HTMLDivElement;
        customContent.style.display = 'none';

        if (files.length === 0) {
            const noResults = document.createElement('article');
            noResults.className = 'margin padding';
            noResults.textContent = 'No results found.';
            this.fileList.appendChild(noResults);
            return
        }

        const content = document.createElement('article');
        content.className = "scroll margin";

        const fragment = document.createDocumentFragment();

        files.forEach(file => {
            const escapedQuery = escapeRegExp(query);
            const regex = new RegExp(`(${escapedQuery})`, 'gi');

            const fileContainer = this.getFileButton(file);
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
        this.fileList.appendChild(content);
        this.updateFileSelectionVisuals();
    }

    renderFileList() {
        this.flattendFileList = [];
        const globalFileTree: { [key: string]: any } = {};
        const customFileTree: { [key: string]: any } = {};

        this.fileList.innerHTML = '';
        this.customCollectionsFileList.innerHTML = '';

        if (this.allCustomCollectionDBFiles.length > 0) {
            this.customCollectionsContainer.style.display = 'block';
        } else {
            this.customCollectionsContainer.style.display = 'none';
        }

        this.allDBFiles.forEach(file => {
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

        this.allCustomCollectionDBFiles.forEach(file => {
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

        this.sortTree(globalFileTree);
        this.sortTree(customFileTree);

        this.flattenFileTree(globalFileTree);
        this.flattenFileTree(customFileTree);


        const globalFileTreeFragment = this.createFileTree(globalFileTree, 0, false);
        this.fileList.appendChild(globalFileTreeFragment);

        const customFileTreeFragment = this.createFileTree(customFileTree, 0, true);
        this.customCollectionsFileList.appendChild(customFileTreeFragment);

        const progressElement = document.querySelector('#progress-bar-container') as HTMLDivElement;
        if (progressElement) {
            progressElement.classList.add('hidden');
            progressElement.style.display = 'none';
        }
    }

    naturalSort(a: string, b: string) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    createFileTree(tree: any, depth: number = 0, customContent: boolean = false): DocumentFragment {
        const fragment = document.createDocumentFragment();

        Object.keys(tree).sort(this.naturalSort).forEach(key => {
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
                                const fileButton = this.getCustomFileButton(file);
                                fileArticle.appendChild(fileButton);
                            } else {
                                const fileButton = this.getFileButton(file);
                                fileArticle.appendChild(fileButton);
                            }
                            const divider = document.createElement('div');
                            divider.className = 'divider';
                            fileArticle.appendChild(divider);
                        });

                        lazyLoadContainer.appendChild(fileArticle);
                    } else {
                        lazyLoadContainer.appendChild(this.createFileTree(value, depth + 1));
                    }
                }
                this.updateFileSelectionVisuals();
            });
            fragment.appendChild(details);
        });
        return fragment;
    };

    updateFileSelectionVisuals() {
        const fileItems = this.container.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            const fileName = item.getAttribute('data-file-name');
            const icon = item.querySelector('i') as HTMLElement;
            if (this.isSelectionMode) {
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

    sortTree(tree: any) {
        Object.keys(tree).forEach(key => {
            if (Array.isArray(tree[key])) {
                tree[key].sort((a: FileData, b: FileData) => this.naturalSort(a.fileName, b.fileName));
            } else {
                this.sortTree(tree[key]);
            }
        });
    };

    flattenFileTree(tree: any, basePath: string = '') {
        Object.keys(tree).sort(this.naturalSort).forEach(key => {
            const value = tree[key];
            const currentPath = basePath ? `${basePath}\\${key}` : key;

            if (Array.isArray(value)) {
                value.forEach((file: FileData) => {
                    this.flattendFileList.push(file);
                });
            } else {
                this.flattenFileTree(value, currentPath);
            }
        });
    }

    async initGlobalDB(): Promise<IDBDatabase> {
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

    async initCustomCollectionDB(): Promise<IDBDatabase> {
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

    async getAllFilesFromDB(db: IDBDatabase): Promise<FileData[]> {
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

    async fetchGlobalFiles(): Promise<FileData[]> {
        const response = await fetch('/api/files?type=global');
        const files: FileData[] = await response.json();

        try {
            if (this.DB) {
                await this.storeFilesinDB(files);
            } else {
                this.DB = await this.initGlobalDB();
                await this.storeFilesinDB(files);
            }
        } catch (error) {
            console.error("Error storing files in IndexedDB:", error);
        }

        return files;
    }

    getCustomFoldersFromLocalStorage(): FolderData[] {
        const folders = localStorage.getItem('customFolders');
        return folders ? JSON.parse(folders) : [];
    }

    addFolderToCustomFolders(folderName: string, adminAccess: boolean) {
        const folders = this.getCustomFoldersFromLocalStorage();
        const existingFolder = folders.find(f => f.folderName === folderName);

        if (!existingFolder) {
            folders.push({ folderName, adminAccess });
            saveCustomFoldersToLocalStorage(folders);
        } else {
            console.log(`Folder "${folderName}" already exists in customFolders.`);
        }
    }

    removeFolderFromCustomFolders(folderName: string) {
        let folders = this.getCustomFoldersFromLocalStorage();
        if (folders.some(f => f.folderName === folderName)) {
            folders = folders.filter(f => f.folderName !== folderName);
            saveCustomFoldersToLocalStorage(folders);
        } else {
            console.log(`Folder "${folderName}" does not exist in customFolders.`);
        }
    }

    async fetchCustomCollectionFiles(): Promise<FileData[]> {
        const foldersData = this.getCustomFoldersFromLocalStorage();
        const params = new URLSearchParams({ type: 'custom' });
        const folders = foldersData.map(folder => folder.folderName);
        folders.forEach(folder => params.append('folders', folder));

        const response = await fetch(`/api/files?${params.toString()}`);
        const files: FileData[] = await response.json();

        try {
            if (this.customCollectionsDB) {
                this.storeFilesinCustomDB(files);
            } else {
                this.customCollectionsDB = await this.initCustomCollectionDB();
                this.storeFilesinCustomDB(files);
            }
        } catch (error) {
            console.error("Error storing files in IndexedDB:", error);
        }
        return files;
    }

    async storeFilesinDB(files: FileData[]) {
        return new Promise((resolve, reject) => {
            if (!this.DB){
                showErrorSnackbar('Error storing files: DB not initialized.');
                return;
            }
            const transaction = this.DB.transaction('files', 'readwrite');
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

    async storeFilesinCustomDB(files: FileData[]) {
        return new Promise((resolve, reject) => {
            if (!this.customCollectionsDB){
                showErrorSnackbar('Error storing files: Custom Collections DB not initialized.');
                return;
            }
            const transaction = this.customCollectionsDB.transaction('files', 'readwrite');
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

    getFileButton(file: FileData): HTMLElement {
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
            if (this.isSelectionMode) {
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
                this.songPage?.displaySong(file);
            }
        });

        return fileContainer;
    }

    getCustomFileButton(file: FileData): HTMLElement {
        const fileButton = document.createElement('a');
        fileButton.className = 'custom-file-item padding surface-container no-round wave wrap';
        fileButton.textContent = file.fileName.replace('.txt', '');
        fileButton.setAttribute('data-file-name', file.fileName);
        fileButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.songPage?.displaySong(file);
        });
        return fileButton;
    }

    async fetchAllPublicFolders(): Promise<string[]> {
        const response = await fetch('/api/public_folders');
        const folders: string[] = await response.json();
        return folders;
    }

    showNav(){
        this.navBar.style.display = "block";
    }

    hideNav(){
        this.navBar.style.display = "none";
    }
}

class SongPage {
    pageID: string;
    navBarID: string;
    singAlongPage?: SingAlongPage;
    homePage?: HomePage;
    flattendFileList: FileData[];
    container: HTMLDivElement;
    songContainer: SongContainer;
    navBar: HTMLDialogElement;
    currentSongIndex: number;
    nextSongButton: HTMLButtonElement;
    prevSongButton: HTMLButtonElement;
    nextParagraphButton: HTMLButtonElement;
    prevParagraphButton: HTMLButtonElement;
    toggleParagraphViewButton: HTMLInputElement;
    touchStartX: number = 0;
    touchEndX: number = 0;
    isSwipe: boolean = false;
    isAnimating: boolean = false;

    constructor(pageID: string, navBarID: string) {
        this.pageID = pageID;
        this.navBarID = navBarID;

        this.songContainer = new SongContainer(this.pageID);
        this.currentSongIndex = 0;
        this.flattendFileList = [];

        this.container = document.getElementById(this.pageID) as HTMLDivElement;
        this.navBar = document.getElementById(this.navBarID) as HTMLDialogElement;
        this.nextSongButton = this.navBar.querySelector("#next-song") as HTMLButtonElement;
        this.prevSongButton = this.navBar.querySelector("#prev-song") as HTMLButtonElement;
        this.nextParagraphButton = this.navBar.querySelector("#next-paragraph") as HTMLButtonElement;
        this.prevParagraphButton = this.navBar.querySelector("#prev-paragraph") as HTMLButtonElement;
        this.toggleParagraphViewButton = this.navBar.querySelector("#toggle-paragraph-view") as HTMLInputElement;

        this.addSwipeListeners();
        this.initialize();
    }

    initialize() {
        this.nextSongButton.addEventListener('click', () => {
            this.moveToNextSong();
        });
        this.prevSongButton.addEventListener('click', () => {
            this.moveToPreviousSong();
        });
        this.nextParagraphButton.addEventListener('click', () => {
            this.songContainer.moveToNextParagraph();
        });
        this.prevParagraphButton.addEventListener('click', () => {
            this.songContainer.moveToPreviousParagraph();
        });
        this.toggleParagraphViewButton.addEventListener('change', () => {
            this.songContainer.toggleParagraphFocus();
        });
    }

    addSwipeListeners() {
        this.container.addEventListener('touchstart', (e: TouchEvent) => {
            this.touchStartX = e.changedTouches[0].screenX;
        });

        this.container.addEventListener('touchend', (e: TouchEvent) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });
    }

    handleSwipe() {
        const swipeThreshold = 50; // Minimum swipe distance (in pixels)

        this.isSwipe = true;

        if (this.touchEndX < this.touchStartX - swipeThreshold) {
            this.moveToNextSong();
            setTimeout(() => {
                if (this.songContainer.focusEnabled) {
                    this.songContainer.currentParagraphIndex = 0;
                    this.songContainer.focusParagraph();
                }
            }, 500);
        } else if (this.touchEndX > this.touchStartX + swipeThreshold) {
            this.moveToPreviousSong();
            setTimeout(() => {
                if (this.songContainer.focusEnabled) {
                    this.songContainer.currentParagraphIndex = 0;
                    this.songContainer.focusParagraph();
                }
            }, 500);
        }

        this.isSwipe = false;
    }

    setReferences(singAlongPage: SingAlongPage, homePage: HomePage) {
        this.singAlongPage = singAlongPage;
        this.homePage = homePage;
        this.flattendFileList = homePage.flattendFileList;
    }

    moveToPreviousSong() {
        if (this.isAnimating) return;

        if (this.homePage) {
            this.flattendFileList = this.homePage.flattendFileList;
        }

        if (this.currentSongIndex > 0) {
            if (this.isSwipe) {
                this.isAnimating = true;

                this.songContainer.header.classList.add('slide-right');
                this.songContainer.content.classList.add('slide-right');

                setTimeout(() => {
                    this.currentSongIndex--;
                    const previousSong = this.flattendFileList[this.currentSongIndex];

                    this.songContainer.header.classList.remove('slide-right');
                    this.songContainer.content.classList.remove('slide-right');

                    this.songContainer.displaySong(previousSong);

                    this.songContainer.header.classList.add('slide-in-right');
                    this.songContainer.content.classList.add('slide-in-right');

                    setTimeout(() => {
                        this.songContainer.header.classList.remove('slide-in-right');
                        this.songContainer.content.classList.remove('slide-in-right');

                        this.isAnimating = false;
                    }, 500);

                }, 500);
            } else {
                this.currentSongIndex--;
                const previousSong = this.flattendFileList[this.currentSongIndex];
                this.songContainer.displaySong(previousSong);
            }
        }

        if (this.songContainer.focusEnabled) {
            this.songContainer.currentParagraphIndex = 0;
            this.songContainer.focusParagraph();
        }
    }

    moveToNextSong() {
        if (this.isAnimating) return;

        if (this.homePage) {
            this.flattendFileList = this.homePage.flattendFileList;
        }

        if (this.currentSongIndex < this.flattendFileList.length - 1) {
            if (this.isSwipe) {
                this.isAnimating = true;

                this.songContainer.header.classList.add('slide-left');
                this.songContainer.content.classList.add('slide-left');

                setTimeout(() => {
                    this.currentSongIndex++;
                    const nextSong = this.flattendFileList[this.currentSongIndex];

                    this.songContainer.header.classList.remove('slide-left');
                    this.songContainer.content.classList.remove('slide-left');

                    this.songContainer.displaySong(nextSong);

                    this.songContainer.header.classList.add('slide-in-left');
                    this.songContainer.content.classList.add('slide-in-left');

                    setTimeout(() => {
                        this.songContainer.header.classList.remove('slide-in-left');
                        this.songContainer.content.classList.remove('slide-in-left');

                        this.isAnimating = false;
                    }, 500);

                }, 500);
            } else {
                this.currentSongIndex++;
                const nextSong = this.flattendFileList[this.currentSongIndex];
                this.songContainer.displaySong(nextSong);
            }
        }

        if (this.songContainer.focusEnabled) {
            this.songContainer.currentParagraphIndex = 0;
            this.songContainer.focusParagraph();
        }
    }

    updateFontSize() {
        this.songContainer.updateFontSize();
    }

    displaySong(file: FileData) {
        if (this.homePage){
            this.flattendFileList = this.homePage.flattendFileList;
        }
        ui('#song');
        window.scrollTo({ top: 0, behavior: 'instant' });
        this.currentSongIndex = this.flattendFileList.findIndex(song => song === file);
        this.songContainer.displaySong(file);
        this.navBar.style.display = "block";
    }

    showNav(){
        this.navBar.style.display = "block";
    }

    hideNav(){
        this.navBar.style.display = "none";
    }
}

class SingAlongPage {
    pageID: string;
    navBarID: string;
    songPage?: SongPage;
    homePage?: HomePage;
    protocol: string;
    socketUrl: string;
    socket: WebSocket | null;
    songContainer: SongContainer;
    flattendFileList?: FileData[];
    container: HTMLDivElement;
    navBar: HTMLDialogElement;
    createSingAlongDialog: HTMLDialogElement;
    joinSingAlongDialog: HTMLDialogElement;
    singAlongControlsContainer: HTMLDivElement;
    openJoinSingAlongDialogButton: HTMLButtonElement;
    openCreateSingAlongDialogButton: HTMLButtonElement;
    endSingAlongButton: HTMLButtonElement;
    leaveSingAlongButton: HTMLButtonElement;
    createSingAlongSubmitButton: HTMLButtonElement;

    constructor(pageID: string, navBarID: string) {
        this.pageID = pageID;
        this.navBarID = navBarID

        this.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.socketUrl = `${this.protocol}//${window.location.host}/ws`;
        this.socket = null;
        this.songContainer = new SongContainer(this.pageID);

        this.container = document.getElementById(this.pageID) as HTMLDivElement;
        this.navBar = document.getElementById(this.navBarID) as HTMLDialogElement;
        this.createSingAlongDialog = document.getElementById('create-sing-along-dialog') as HTMLDialogElement;
        this.joinSingAlongDialog = document.getElementById('join-sing-along-dialog') as HTMLDialogElement;

        this.singAlongControlsContainer = this.container.querySelector("#sing-along-controls") as HTMLDivElement;
        this.openJoinSingAlongDialogButton = this.singAlongControlsContainer.querySelector("#open-join-sing-along-dialog") as HTMLButtonElement;
        this.openCreateSingAlongDialogButton = this.singAlongControlsContainer.querySelector("#open-create-sing-along-dialog") as HTMLButtonElement;
        this.endSingAlongButton = this.navBar.querySelector("#end-sing-along") as HTMLButtonElement;
        this.leaveSingAlongButton = this.navBar.querySelector("#sing-along-logout") as HTMLButtonElement;

        this.createSingAlongSubmitButton = this.openCreateSingAlongDialogButton.querySelector('#create-sing-along-submit') as HTMLButtonElement;

        this.initialize();
    }

    initialize() {
        this.openCreateSingAlongDialogButton.addEventListener('click', () => {
            ui('#create-sing-along-dialog');
        });
        this.endSingAlongButton.addEventListener('click', async (event) => {
            event.preventDefault();
            this.endSingAlong();
        });
        this.leaveSingAlongButton.addEventListener('click', async (event) => {
            event.preventDefault();
            this.leaveSingAlong();
        });
        this.openJoinSingAlongDialogButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await fetch('/api/public_sing_alongs')
                .then(response => response.json())
                .then(data => {
                    const singAlongs = data.map((singAlong: { name: string; description: string; }) => {
                        return {
                            name: singAlong.name,
                            description: singAlong.description,
                        };
                    });
                    const singAlongIdContainer = document.getElementById('sing-along-id-container') as HTMLDivElement;
                    singAlongIdContainer.innerHTML = '';
                    const singAlongSelect = document.getElementById('sing-along-id-container') as HTMLDivElement;
                    singAlongs.forEach((singAlong: { name: string; description: string; }) => {
                        const button: HTMLButtonElement = document.createElement('button');
                        const icon = document.createElement('i');
                        icon.textContent = 'login';
                        const span = document.createElement('span');
                        span.textContent = singAlong.name + ' - ' + singAlong.description;
                        button.appendChild(icon);
                        button.appendChild(span);
                        button.className = "small-round responsive left-align";
                        button.id = singAlong.name;
                        button.addEventListener('click', () => {
                            const isHost = localStorage.getItem('is_host') === 'true';
                            this.joinSingAlong(singAlong.name, isHost);
                            this.openCreateSingAlongDialogButton.style.display = 'none';
                            this.openJoinSingAlongDialogButton.style.display = 'none';
                            this.leaveSingAlongButton.style.display = 'block';
                            this.endSingAlongButton.style.display = 'none';
                            ui('#join-sing-along-dialog');
                        });
                        singAlongSelect.appendChild(button);
                    });
                });
            ui('#join-sing-along-dialog');
        });
    }

    setReferences(songPage: SongPage, homePage: HomePage) {
        this.songPage = songPage;
        this.homePage = homePage;
        this.flattendFileList = homePage.flattendFileList;
    }

    updateFontSize() {
        this.songContainer.updateFontSize();
    }

    setupWebSocket(onOpenCallback?: () => void) {
        this.socket = new WebSocket(this.socketUrl);

        this.socket.onopen = () => {
            if (onOpenCallback) {
                onOpenCallback();
            }
        };

        this.socket.onmessage = (event) => {
            const data: SingAlongData = JSON.parse(event.data);
            console.log(data);
            this.handleWebSocketMessage(data);
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleWebSocketMessage(data: SingAlongData) {
        switch (data.action) {
            case 'created':
                localStorage.setItem('sing_along_id', data.sing_along_id);
                localStorage.setItem('is_host', 'true');
                break;
            case 'joined':
                localStorage.setItem('sing_along_id', data.sing_along_id);
                localStorage.setItem('is_host', 'false');
                this.getSong();
                break;
            case 'change_song':
                this.updateUIWithNewSong(data.song);
                break;
            case 'get_song':
                const songData = this.getFileDataFromSongName(data.song);
                if (songData) {
                    this.songContainer.displaySong(songData);
                }
                break;
            case 'sync':
                this.syncClient(data);
                break;
            case 'end_sing_along':
                this.endSingAlong();
                break;
            default:
                console.log('Unknown action:', data.action);
                showErrorSnackbar(data.message);
                localStorage.removeItem('sing_along_id');
                localStorage.removeItem('is_host');
        }
    }

    createSingAlong(singAlongId: string, description: string, isPrivate: boolean, songList: string[]) {
        if (!this.socket) {
            this.setupWebSocket(() => {
                if (singAlongId && this.socket) {
                    const data: SingAlongData = {
                        action: 'create',
                        sing_along_id: singAlongId,
                        description: description,
                        song_list: songList,
                        private: isPrivate
                    };
                    this.socket.send(JSON.stringify(data));

                    this.openCreateSingAlongDialogButton.style.display = 'none';
                    this.openJoinSingAlongDialogButton.style.display = 'none';
                    this.leaveSingAlongButton.style.display = 'none';
                    this.endSingAlongButton.style.display = 'block';
                }
            });
        } else {
            if (singAlongId && this.socket) {
                const data: SingAlongData = {
                    action: 'create',
                    sing_along_id: singAlongId,
                    description: description,
                    song_list: songList,
                    private: isPrivate
                };
                this.socket.send(JSON.stringify(data));

                this.openCreateSingAlongDialogButton.style.display = 'none';
                this.openJoinSingAlongDialogButton.style.display = 'none';
                this.leaveSingAlongButton.style.display = 'none';
                this.endSingAlongButton.style.display = 'block';
            }
        }
    }

    joinSingAlong(singAlongId: string, isHost: boolean = false) {
        if (!this.socket) {
            this.setupWebSocket(() => {
                if (singAlongId && this.socket) {
                    const data: SingAlongData = {
                        action: 'join',
                        sing_along_id: singAlongId,
                        is_host: isHost
                    };
                    this.socket.send(JSON.stringify(data));
                    this.openCreateSingAlongDialogButton.style.display = 'none';
                    this.openJoinSingAlongDialogButton.style.display = 'none';
                    this.leaveSingAlongButton.style.display = 'block';
                    this.endSingAlongButton.style.display = 'none';
                }
            });
        } else {
            if (singAlongId && this.socket) {
                const data: SingAlongData = {
                    action: 'join',
                    sing_along_id: singAlongId,
                    is_host: isHost
                };
                this.socket.send(JSON.stringify(data));
                this.openCreateSingAlongDialogButton.style.display = 'none';
                this.openJoinSingAlongDialogButton.style.display = 'none';
                this.leaveSingAlongButton.style.display = 'block';
                this.endSingAlongButton.style.display = 'none';
            }
        }
    }

    changeSong(song: string) {
        if (this.socket) {
            const data: SingAlongData = {
                action: 'change_song',
                song: song
            };
            this.socket.send(JSON.stringify(data));
        }
    }

    getSong() {
        if (this.socket) {
            const data: SingAlongData = {
                action: 'get_song',
            };
            this.socket.send(JSON.stringify(data));
        }
    }

    syncClient(data: any) {
        const singAlongId = localStorage.getItem('sing_along_id');
        const isHost = localStorage.getItem('is_host') === 'true';
        if (singAlongId && !isHost) {
            const songData = this.getFileDataFromSongName(data.current_song);
            if (songData) {
                this.songContainer.displaySong(songData);
            }
            showSuccessSnackbar('Synced with Sing-Along.');
        }
    }

    leaveSingAlong() {
        if (this.socket) {
            const data: SingAlongData = {
                action: 'leave'
            };
            this.socket.send(JSON.stringify(data));
            this.socket.close();
            this.socket = null;
        }
        localStorage.removeItem('sing_along_id');
        localStorage.removeItem('is_host');
        showSuccessSnackbar('Left Sing-Along.');

        this.openCreateSingAlongDialogButton.style.display = 'block';
        this.openJoinSingAlongDialogButton.style.display = 'block';
        this.leaveSingAlongButton.style.display = 'none';
        this.endSingAlongButton.style.display = 'none';
    }

    endSingAlong() {
        if (this.socket) {
            const data: SingAlongData = {
                action: 'end'
            };
            this.socket.send(JSON.stringify(data));
            this.socket.close();
            this.socket = null;
        }
        localStorage.removeItem('sing_along_id');
        localStorage.removeItem('is_host');

        showSuccessSnackbar('Sing-Along ended.');
        this.openCreateSingAlongDialogButton.style.display = 'block';
        this.openJoinSingAlongDialogButton.style.display = 'block';
        this.leaveSingAlongButton.style.display = 'none';
        this.endSingAlongButton.style.display = 'none';
    }

    updateUIWithNewSong(song: string) {
        console.log('Now playing:', song);
        const songData = this.getFileDataFromSongName(song);
        if (songData) {
            this.songContainer.displaySong(songData);
        }
    }

    getFileDataFromSongName(songName: string): FileData | undefined {
        if (this.flattendFileList !== undefined) {
            return this.flattendFileList.find(file => file.fileName === songName);
        }
        return undefined;
    }

    showNav(){
        this.navBar.style.display = "block";
    }

    hideNav(){
        this.navBar.style.display = "none";
    }
}

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

function cleanUpCustomDB(selectedFolders: string[]) {
    const customCollectionsDB = homePage.customCollectionsDB;
    if (!customCollectionsDB) {
        return;
    }
    return new Promise<void>((resolve, reject) => {
        const transaction = customCollectionsDB.transaction('files', 'readwrite');
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

function getFontSize(): number {
    return parseInt(localStorage.getItem('fontSize') || '16', 10);
}

function setFontSize(size: number) {
    localStorage.setItem('fontSize', size.toString());
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

function hashChanged() {
    const tabs = document.querySelectorAll('.tabs a');
    const pages = document.querySelectorAll('.page');
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
            if (hash === '#home') {
                homePage.showNav();
                songPage.hideNav();
                singAlongPage.hideNav();
            } else if (hash === '#song') {
                homePage.hideNav();
                songPage.showNav();
                singAlongPage.hideNav();
            } else if (hash === '#sing-along-page') {
                homePage.hideNav();
                songPage.hideNav();
                singAlongPage.showNav();
            }
        } else {
            page.classList.remove('active');
        }
    });
}

function updateIcon(mode: string) {
    const iconElements = document.querySelectorAll("#toggle-theme i");
    iconElements.forEach(iconElement => {
        iconElement.textContent = mode === "dark" ? "light_mode" : "dark_mode";
    });
};

function toggleTheme() {
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
    const VERSION = localStorage.getItem('latestVersion') || '1.0.1';
    const appNameVersion = document.getElementById('app-name-version') as HTMLHeadingElement;
    appNameVersion.textContent = `Hutterite Bookshelf v${VERSION}`;

    singAlongPage = new SingAlongPage('sing-along-page', 'sing-along-nav');
    songPage = new SongPage('song', 'song-nav')
    homePage = new HomePage('home', 'home-nav');

    singAlongPage.setReferences(songPage, homePage);
    songPage.setReferences(singAlongPage, homePage);
    homePage.setReferences(songPage, singAlongPage);

    const tabs = document.querySelectorAll('.tabs a');
    const customFolderList = document.getElementById('custom-folders-list') as HTMLDivElement;
    const installPWA = document.getElementById('install-pwa') as HTMLButtonElement;
    const installIcon = installPWA.querySelector('i') as HTMLElement;


    if (isMobileDevice()) {
        installIcon.textContent = `install_mobile`;
    } else {
        installIcon.textContent = `install_desktop`;
    }

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

            if (targetPageId === '#home') {
                homePage.showNav();
                songPage.hideNav();
                singAlongPage.hideNav();
            } else if (targetPageId === '#song') {
                if (songPage.songContainer.focusEnabled) {
                    songPage.songContainer.focusParagraph();
                }
                homePage.hideNav();
                songPage.showNav();
                singAlongPage.hideNav();
            } else if (targetPageId === '#sing-along-page') {
                if (singAlongPage.songContainer.focusEnabled) {
                    singAlongPage.songContainer.focusParagraph();
                }
                homePage.hideNav();
                songPage.hideNav();
                singAlongPage.showNav();
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
        setFontSize(newSize);
    });
    document.querySelector('#text-decrease')?.addEventListener('click', () => {
        const newSize = Math.max(getFontSize() - 1, 10);
        setFontSize(newSize);
    });
    document.querySelector('#toggle-theme')?.addEventListener('click', toggleTheme);
    document.querySelector('#nav-bar-open')?.addEventListener('click', () => {
        ui('#nav-bar');
    });
    document.querySelector('#nav-bar-close')?.addEventListener('click', () => {
        ui('#nav-bar');
    });
    document.querySelector('#custom-collections-dialog-close')?.addEventListener('click', () => {
        ui('#custom-collections-dialog');
    });
    document.querySelector('#toggle-collections')?.addEventListener('click', async () => {
        customFolderList.innerHTML = '';
        publicFolders = await homePage.fetchAllPublicFolders();
        const folders = homePage.getCustomFoldersFromLocalStorage();
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
    document.querySelector('#custom-collections-dialog-apply')?.addEventListener('click', async () => {
        showSuccessSnackbar('Loading...');

        const customFolders = homePage.getCustomFoldersFromLocalStorage();
        const selectedFolders = customFolders.map(folder => folder.folderName);

        cleanUpCustomDB(selectedFolders);

        const customCollectionDBFiles = await homePage.fetchCustomCollectionFiles();

        homePage.allCustomCollectionDBFiles = customCollectionDBFiles;

        homePage.renderFileList();

        showSuccessSnackbar('Collections updated successfully.');
    });

    const savedSingAlongId = localStorage.getItem('sing_along_id');
    const isHost = localStorage.getItem('is_host') === 'true';

    if (savedSingAlongId) {
        singAlongPage.joinSingAlong(savedSingAlongId, isHost);
        if (isHost) {
            showSuccessSnackbar('Sing-Along host status restored.');
        } else {
            showSuccessSnackbar('Sing-Along re-joined.');
            singAlongPage.getSong();
        }
    }
});

async function checkForUpdates(registration: ServiceWorkerRegistration) {
    const response = await fetch('/version');
    const data = await response.json();
    const VERSION: string = data.version;

    const currentVersion = localStorage.getItem('latestVersion') || "1.0.0";

    if (currentVersion !== VERSION) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.action === 'cacheUpdated') {
                setTimeout(() => {
                    showUpdateCompleteSnackbar(`Update available: v${VERSION}`);
                }, 5000);
            }
        });

        if (currentVersion !== VERSION) {
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data.action === 'cacheUpdated') {
                    setTimeout(() => {
                        showUpdateCompleteSnackbar(`Update available: v${VERSION}`);
                    }, 5000);
                }
            });

            if (registration.active) {
                registration.active.postMessage({ action: 'newUpdateCache' });
                console.log('New version detected, updating cache...');
            }
            localStorage.setItem('latestVersion', VERSION);
        } else {
            if (registration.active) {
                registration.active.postMessage({ action: 'updateCache' });
                console.log('Version check passed, updating cache...');
            }
        }
        localStorage.setItem('latestVersion', VERSION);
    }
}

async function load() {
    let savedMode = localStorage.getItem("mode") || "dark";
    ui("mode", savedMode);
    updateIcon(savedMode);
    try {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/serviceWorker.js', { scope: '/' });
                console.log('ServiceWorker registration successful with scope: /');

                if (navigator.onLine) {
                    await checkForUpdates(registration);
                } else {
                    console.log('Offline: Skipping version check');
                }
            } catch (error) {
                console.log('ServiceWorker registration failed: ', error);
            }
        }
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

window.addEventListener('load', load);
window.addEventListener('popstate', hashChanged);
