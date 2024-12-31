import { AutoSizeDialog } from "./autoSize";
import { Overlay } from "./overlay";

export class CollectionsDialog extends Overlay {
    dialog: HTMLDialogElement;
    closeButton: HTMLButtonElement;

    constructor() {
        super();
        super.attachTo();
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
            <dialog class="max" id="collections-dialog">
                <nav>
                    <button id="close-button" class="transparent link circle m l"><i>close</i></button>
                </nav>
                <div>
                    <div class="page padding active" id="bookmarks-tab">
                        <h5 class="center-align">Bookmarks</h5>
                    </div>
                    <div class="page padding" id="favorites-tab">
                        <h5 class="center-align">Favorites</h5>
                    </div>
                    <div class="page padding" id="history-tab">
                        <h5 class="center-align">History</h5>
                    </div>
                    <div class="page padding" id="collections-tab">
                        <h5 class="center-align">Collections</h5>
                    </div>
                </div>
                <nav class="tabs fixed bottom row">
                    <a class="vertical active" data-ui="#bookmarks-tab">
                        <i>bookmark</i>
                        <span>Bookmarks</span>
                    </a>
                    <a class="vertical" data-ui="#favorites-tab">
                        <i>favorite</i>
                        <span>Favorites</span>
                    </a>
                    <a class="vertical" data-ui="#history-tab">
                        <i>history</i>g
                        <span>History</span>
                    </a>
                    <a class="vertical" data-ui="#collections-tab">
                        <i>collections_bookmark</i>
                        <span>Collections</span>
                    </a>
                </nav>
            </dialog>
        `.trim();

        this.dialog = template.content.firstElementChild as HTMLDialogElement;
        this.closeButton = this.dialog.querySelector("#close-button") as HTMLButtonElement;
        this.init();
    }

    init() {
        this.closeButton.onclick = () => {
            this.close();
            window.location.hash = "";
        }
    }

    public open(){
        super.showOverlay();
        this.dialog.show()
    }

    public close(){
        super.hideOverlay();
        this.dialog.close();
    }

    public attachTo(parent: HTMLElement = document.body) {
        parent.appendChild(this.dialog);
    }
}
