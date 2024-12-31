import { AutoSizeDialog } from "./autoSize";
import { Overlay } from "./overlay";

export class InfoDialog extends Overlay implements AutoSizeDialog {
    private dialog: HTMLDialogElement;

    constructor() {
        super();
        super.attachTo();
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
        <dialog class="max" id="info-dialog">
            <nav>
                <button class="transparent link circle" onclick="ui('#info-dialog')"><i>close</i></button>
            </nav>
            <div class="row max center-align">
                <img class="responsive circle border logo" style="max-width: 150px; height: auto;" fetchpriority="low" loading="lazy" src="/static/icons/icon.png" alt="" width="128" height="128">
            </div>
            <h5 class="small center-align">Hutterite Bookshelf <span class="small-text" id="app-version"></span></h5>
            <br>
            <p class="center-align no-line">A comprehensive app for accessing, managing, and sharing Hutterite literature.</p>
            <br>
            <p class="center-align">Developed with <button class="chip small-round circle no-border transparent no-margin"><i style="color: var(--error)">favorite</i><div class="tooltip top">love</div></button> by <a class="link" href="https://thecodingjsoftware.github.io/">TheCodingJ's</a></p>
            <br>
            <article class="border" style="margin-top: auto;">
                <p class="center-align medium-width no-line">
                    For questions, comments, suggestions,
                    or concerns about this service please
                    email: <a class="link" href="mailto:jared@pinelandfarms.ca">jared@pinelandfarms.ca</a>
                </p>
            </article>
            <div class="row center-align">
                <a class="link small-text" href="/privacy_policy">Privacy Policy</a>
            </div>
            </dialog>
        `.trim();

        this.dialog = template.content.firstElementChild as HTMLDialogElement;

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
