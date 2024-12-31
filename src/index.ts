import "beercss";
import "material-dynamic-colors";
import "remixicon/fonts/remixicon.css";
import "../static/css/style.css";
import { loadTheme, loadAnimationStyleSheet } from "./utils/theme";
import { SearchBookshelfDialog } from "./dialogs/searchBookshelfDialog";
import { SetThemeDialog } from "./dialogs/themeDialog";
import { InfoDialog } from "./dialogs/infoDialog";
import { CollectionsDialog } from "./dialogs/collectionsDialog";
import { Tags } from "./utils/tags";
import { BookButton } from "./utils/bookButton";
import { SubjectButton } from "./utils/subjectButton";

const setThemeDialog = new SetThemeDialog();
const infoDialog = new InfoDialog();
const searchBookshelfDialog = new SearchBookshelfDialog();
const sidePanelDialog = new CollectionsDialog();

setThemeDialog.attachTo();
infoDialog.attachTo();
searchBookshelfDialog.attachTo();
sidePanelDialog.attachTo();

const searchBar = document.getElementById("search-bar") as HTMLDivElement;
const searchInputBar = searchBar.querySelector("#search-input-bar") as HTMLInputElement;
const searchIcon = searchBar.querySelector("#search-icon") as HTMLButtonElement;
const sidePanelButton = document.getElementById("open-bookmarks-button") as HTMLButtonElement;


function showUpdateCompleteSnackbar(message: string) {
    const snackbar = document.getElementById("update-snackbar") as HTMLDivElement;
    const snackbarUpdate = snackbar.querySelector(
        "#update-snackbar-update"
    ) as HTMLAnchorElement;
    snackbarUpdate.onclick = () => {
        window.location.reload();
    };
    const snackbarText = snackbar.querySelector(
        "#update-snackbar-text"
    ) as HTMLDivElement;
    snackbarText.textContent = message;
    ui("#update-snackbar", 6000);
}

async function checkForUpdates(registration: ServiceWorkerRegistration) {
    const response = await fetch("/version");
    const data = await response.json();
    const VERSION: string = data.version;

    const currentVersion = localStorage.getItem("latestVersion") || "1.0.0";

    if (currentVersion !== VERSION) {
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data.action === "cacheUpdated") {
                setTimeout(() => {
                    showUpdateCompleteSnackbar(`Update available: v${VERSION}`);
                }, 5000);
            }
        });

        if (currentVersion !== VERSION) {
            navigator.serviceWorker.addEventListener("message", (event) => {
                if (event.data.action === "cacheUpdated") {
                    setTimeout(() => {
                        showUpdateCompleteSnackbar(`Update available: v${VERSION}`);
                    }, 5000);
                }
            });

            if (registration.active) {
                registration.active.postMessage({ action: "newUpdateCache" });
                console.log("New version detected, updating cache...");
            }
        } else {
            if (registration.active) {
                registration.active.postMessage({ action: "updateCache" });
                console.log("Version check passed, updating cache...");
            }
        }
    }
    // localStorage.setItem('latestVersion', VERSION);
    const appVersion = document.getElementById("app-version") as HTMLSpanElement;
    appVersion.textContent = `v${VERSION}`;
}

async function loadServiceWorker() {
    try {
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.register(
                    "/serviceWorker.js",
                    { scope: "/" }
                );
                console.log("ServiceWorker registration successful with scope: /");

                if (navigator.onLine) {
                    await checkForUpdates(registration);
                } else {
                    console.log("Offline: Skipping version check");
                }
            } catch (error) {
                console.log("ServiceWorker registration failed: ", error);
            }
        }
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

async function loadBooks(){
    const booksList = document.getElementById("books-list") as HTMLDivElement;
    for (const book of Object.values(Tags.BOOKS)) {
        const bookButton = new BookButton(book);
        booksList.appendChild(bookButton.getButton());
    }
}

async function loadSubjects(){
    const subjectsList = document.getElementById("subjects-list") as HTMLDivElement;
    for (const subject of Object.values(Tags.GERMAN_SUBJECTS)) {
        const subjectButton = new SubjectButton(subject);
        subjectsList.appendChild(subjectButton.getButton());
    }
}

async function loadUIComponents() {
    try {
        searchIcon.addEventListener("click", () => {
            searchBookshelfDialog.open();
            window.location.hash = "#search";
            setTimeout(() => {
                searchBookshelfDialog.searchInput.select();
                searchBookshelfDialog.searchInput.focus();
            }, 50);
        });

        searchInputBar.addEventListener("click", () => {
            searchBookshelfDialog.open();
            window.location.hash = "#search";
            setTimeout(() => {
                searchBookshelfDialog.searchInput.select();
                searchBookshelfDialog.searchInput.focus();
            }, 50);
        });

        sidePanelButton.addEventListener("click", () => {
            window.location.hash = "#bookmarks";
        });

    } catch (error) {
        console.error("Error loading UI components:", error);
    }
}

function checkHashes() {
    const hash = window.location.hash;
    if (hash === "#baptism-booklet") {
        window.location.hash = "";
        window.location.href = "/baptism_booklet";
        return;
    }
    if (hash === "#bookmarks") {
        sidePanelDialog.open();
        return;
    }
    if (hash === "#search") {
        searchBookshelfDialog.open();
        return;
    }
    if (hash !== "") {
        searchBookshelfDialog.open();
        searchBookshelfDialog.setTag(hash)
    } else {
        searchBookshelfDialog.searchInput.blur();
        searchBookshelfDialog.close();
        sidePanelDialog.close();
    }
}

window.addEventListener("popstate", () => {
    checkHashes();
});

document.addEventListener("DOMContentLoaded", () => {
    checkHashes();
});

document.addEventListener("DOMContentLoaded", async () => {
    loadTheme().then(() => {
        setTimeout(() => {
            loadAnimationStyleSheet();
        }, 100);
    }).catch(error => console.error('Failed to load theme:', error));

    Promise.all([
        loadBooks(),
        loadSubjects(),
        loadUIComponents()
    ])
});
