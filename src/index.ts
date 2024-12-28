import "beercss";
import "material-dynamic-colors";
import "remixicon/fonts/remixicon.css";
import "../static/css/style.css";
import { loadTheme, loadAnimationStyleSheet } from "./utils/theme";
import { BookButtonManager } from "./utils/bookButtonManager";
import { SearchBookshelfDialog } from "./dialogs/searchBookshelfDialog";
import { Tags } from "./utils/tags";
import { BookButton } from "./utils/bookButton";

const bookButtonManager = new BookButtonManager();
const searchBookshelfDialog = new SearchBookshelfDialog();
searchBookshelfDialog.attachTo();

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

async function loadUIComponents() {
    try {
        const [themeDialogModule, infoDialogModule] = await Promise.all([
            import("./dialogs/themeDialog"),
            import("./dialogs/infoDialog"),
        ]);

        const { SetThemeDialog } = themeDialogModule;
        const { InfoDialog } = infoDialogModule;

        const setThemeDialog = new SetThemeDialog();
        setThemeDialog.attachTo();

        const infoDialog = new InfoDialog();
        infoDialog.attachTo();

        const searchButton = document.getElementById("search-button") as HTMLButtonElement;
        searchButton.onclick = () => {
            window.location.hash = "#search";
            searchBookshelfDialog.open();
        };
    } catch (error) {
        console.error("Error loading UI components:", error);
    }
}

function checkHashes() {
    const hash = window.location.hash;
    if (hash === "#alleluia-sing") {
        bookButtonManager.openAlleluiaSingDialog();
    } else if (hash === "#search") {
        searchBookshelfDialog.open();
    } else {
        bookButtonManager.closeAllDialogs();
        searchBookshelfDialog.close();
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
    await loadBooks();
    await loadUIComponents();
});
