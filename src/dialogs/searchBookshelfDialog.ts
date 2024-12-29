import { AutoSizeDialog } from "./autoSize";
import { Overlay } from "./overlay";
import { Tags } from "../utils/tags";
import { TagButton } from "../utils/tagButton";

export class SearchBookshelfDialog extends Overlay implements AutoSizeDialog {
    title: string = "Search Bookshelf";
    dialog: HTMLDialogElement;
    searchBar: HTMLDivElement;
    searchInput: HTMLInputElement;
    songList: HTMLDivElement;
    closeButton: HTMLButtonElement;
    tagButtons: TagButton[] = [];
    progressBar: HTMLProgressElement;
    enabledTagsBadge: HTMLDivElement;

    constructor() {
        super();
        super.attachTo();
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
            <dialog id="search-dialog">
                <div class="row center">
                    <h6 class="max left-align">Search Bookshelf</h6>
                    <button class="transparent link circle" id="close-dialog">
                        <i>close</i>
                    </button>
                </div>
                <div class="row">
                    <button class="circle">
                        <i>filter_alt</i>
                        <menu class="right small-round" style="width: calc(100vw - 50px); max-width: 400px;">
                            <div id="books-tag-list">
                            </div>
                            <hr class="tiny-margin">
                            <div id="subjects-tag-list">
                            </div>
                        </menu>
                        <div class="badge" id="enabled-tags-badge"></div>
                    </button>
                    <div class="field label prefix border round small max" id="search-bar">
                        <i>search</i>
                        <input type="search" type="text" id="search-input" spellcheck="false" autocapitalize="off" autocomplete="off" autofocusoff/>
                        <label>Search</label>
                        <progress id="search-progress" class="circle hidden"></progress>
                        <span class="helper">Search using song titles or numbers</span>
                    </div>
                </div>
                <div id="song-list">
                </div>
            </dialog>
        `.trim();

        this.dialog = template.content.firstElementChild as HTMLDialogElement;
        this.searchBar = this.dialog.querySelector("#search-bar") as HTMLDivElement;
        this.searchInput = this.searchBar.querySelector("#search-input") as HTMLInputElement;
        this.songList = this.dialog.querySelector("#song-list") as HTMLDivElement;
        this.closeButton = this.dialog.querySelector("#close-dialog") as HTMLButtonElement;
        this.progressBar = this.dialog.querySelector("#search-progress") as HTMLProgressElement;
        this.enabledTagsBadge = this.dialog.querySelector("#enabled-tags-badge") as HTMLDivElement;
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
            this.search(searchTerm);
        });

        this.closeButton.onclick = () => this.close();
        this.setSearchTermFromLocalStorage();

        this.loadBookTags();
        this.loadSubjectTags();
    }

    public loadBookTags() {
        const booksTagList = this.dialog.querySelector("#books-tag-list") as HTMLDivElement;
        for (const tag of Object.values(Tags.BOOKS)) {
            const tagButton = new TagButton(tag, this);
            booksTagList.appendChild(tagButton.getButton());
            this.tagButtons.push(tagButton);
        }
    }

    public loadSubjectTags() {
        const subjectsTagList = this.dialog.querySelector("#subjects-tag-list") as HTMLDivElement;
        for (const tag of Object.values(Tags.GERMAN_SUBJECTS)) {
            const tagButton = new TagButton(tag, this);
            subjectsTagList.appendChild(tagButton.getButton());
            this.tagButtons.push(tagButton);
        }
    }

    public updateEnabledTagsBadge(){
        const enabledTags = this.tagButtons.filter(tagButton => tagButton.isSelected()).length;
        if (enabledTags === 0) {
            this.enabledTagsBadge.classList.add("hidden");
            return;
        }
        this.enabledTagsBadge.classList.remove("hidden");
        this.enabledTagsBadge.textContent = enabledTags.toString();
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

    private search(searchTerm: string){
        this.progressBar.classList.remove("hidden");
        this.searchBar.classList.add("suffix");
        setTimeout(() => {
            this.progressBar.classList.add("hidden");
            this.searchBar.classList.remove("suffix");
        }, 1000);
    }

    public open(){
        super.showOverlay();
        this.dialog.show()
        this.setSearchTermFromLocalStorage();
    }

    public setTag(hash: string){
        this.tagButtons.forEach(tagButton => {
            tagButton.unselect();
        });
        const tag = hash.replace("#", "");
        this.tagButtons.forEach(tagButton => {
            if (tagButton.tagID === tag) {
                tagButton.select();
                tagButton.getButton().scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
                return
            }
        });
    }

    public close(){
        super.hideOverlay();
        this.dialog.close();
        window.location.hash = "";
        // this.clearSearchFromLocalStorage()
    }

    adjustDialogForScreenSize() {
        if (window.innerWidth <= 600) {
            this.dialog.classList.add('max');
        } else {
            this.dialog.classList.remove('max');
        }
    }

    public attachTo(parent: HTMLElement = document.body) {
        parent.appendChild(this.dialog);
    }
}
