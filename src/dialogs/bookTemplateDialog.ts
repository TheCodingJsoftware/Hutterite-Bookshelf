import { AutoSizeDialog } from "./autoSize";
import { Overlay } from "./overlay";

export class BookTemplateDialog extends Overlay implements AutoSizeDialog {
    title: string;
    dialog: HTMLDialogElement;
    searchInput: HTMLInputElement;
    songList: HTMLDivElement;
    closeButton: HTMLButtonElement;
    clearSearchButton: HTMLButtonElement;

    constructor(title: string) {
        super();
        super.attachTo();
        this.title = title;
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
            <dialog>
                <h4 class="center-align">${title}</h4>
                <div class="row">
                    <div class="field label prefix border small max">
                        <i>search</i>
                        <input type="search" type="text" id="search-input" spellcheck="false" autocapitalize="off" autocomplete="off" autofocusoff/>
                        <label>Search</label>
                        <span class="helper">Search using song titles or numbers</span>
                    </div>
                    <button class="transparent link circle" id="clear-search-button">
                        <i>close</i>
                    </button>
                </div>
                <div id="song-list">
                </div>
                <nav class="right-align">
                    <button class="transparent link small-round" id="close-dialog">
                        <span>Close</span>
                    </button>
                </nav>
            </dialog>
        `.trim();

        this.dialog = template.content.firstElementChild as HTMLDialogElement;
        this.searchInput = this.dialog.querySelector("#search-input") as HTMLInputElement;
        this.songList = this.dialog.querySelector("#song-list") as HTMLDivElement;
        this.closeButton = this.dialog.querySelector("#close-dialog") as HTMLButtonElement;
        this.clearSearchButton = this.dialog.querySelector("#clear-search-button") as HTMLButtonElement;
        this.init();
    }

    init() {
        let lastWidth = window.innerWidth;
        this.adjustDialogForScreenSize();
        window.addEventListener('resize', () => {
            const currentWidth = window.innerWidth;
            if (currentWidth !== lastWidth) {
                this.adjustDialogForScreenSize();
                lastWidth = currentWidth;
            }
        });
        this.searchInput.addEventListener("input", () => {
            const searchTerm = this.searchInput.value.toLowerCase();
            this.addSearchToLocalStorage(searchTerm);
        });
        this.closeButton.onclick = () => this.close();
        this.setSearchTermFromLocalStorage();

        this.clearSearchButton.onclick = () => {
            this.searchInput.value = "";
            this.addSearchToLocalStorage("");
        };
    }

    public addSearchToLocalStorage(searchTerm: string){
        const key = `search-${this.title}`;
        localStorage.setItem(key, searchTerm);
    }

    private setSearchTermFromLocalStorage() {
        const key = `search-${this.title}`;
        const searchTerm = localStorage.getItem(key);

        if (searchTerm) {
            this.searchInput.value = searchTerm;
        }
    }

    private clearSearchFromLocalStorage() {
        const key = `search-${this.title}`;
        localStorage.removeItem(key);
    }

    public open(){
        super.showOverlay();
        this.dialog.show()
        this.setSearchTermFromLocalStorage();
    }

    public close(){
        super.hideOverlay();
        this.dialog.close();
        window.location.hash = "";
        this.clearSearchFromLocalStorage();
    }

    public attachTo(parent: HTMLElement = document.body) {
        parent.appendChild(this.dialog);
    }

    adjustDialogForScreenSize() {
        if (window.innerWidth <= 600) {
            this.dialog.classList.add('max');
        } else {
            this.dialog.classList.remove('max');
        }
    }
}