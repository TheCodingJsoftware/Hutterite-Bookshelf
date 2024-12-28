import { setTheme, setMode, savedTheme, savedMode, appSettings } from '../utils/theme';
import { Overlay } from "./overlay";

export class SetThemeDialog extends Overlay {
    private dialog: HTMLDialogElement;

    constructor() {
        super();
        super.attachTo();
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
        <dialog class="right" id="set-theme-dialog">
            <h4 class="center-align">Color Theme</h4>
            <h6 class="padding">Select Color</h6>
            <div id="theme-buttons">
                <div class="padding">
                    <div class="row center-align">
                        <button class="l2 m2 s3 center-align circle small red" data-color="#f44336" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small pink" data-color="#e91e63" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small purple" data-color="#9c27b0" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small deep-purple" data-color="#673ab7" id="theme-button"></button>
                    </div>
                    <div class="row center-align">
                        <button class="l2 m2 s3 center-align circle small indigo" data-color="#3f51b5" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small blue" data-color="#2196f3" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small light-blue" data-color="#03a9f4" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small cyan" data-color="#00bcd4" id="theme-button"></button>
                    </div>
                    <div class="row center-align">
                        <button class="l2 m2 s3 center-align circle small teal" data-color="#009688" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small green" data-color="#4caf50" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small light-green" data-color="#8bc34a" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small lime" data-color="#cddc39" id="theme-button"></button>
                    </div>
                    <div class="row center-align">
                        <button class="l2 m2 s3 center-align circle small yellow" data-color="#ffeb3b" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small amber" data-color="#ffc107" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small orange" data-color="#ff9800" id="theme-button"></button>
                        <button class="l2 m2 s3 center-align circle small deep-orange" data-color="#ff5722" id="theme-button"></button>
                    </div>
                    <div class="row center-align">
                        <button class="small-round">
                            <i>palette</i>
                            <span>Select Color</span>
                            <input type="color" id="select-color">
                        </button>
                    </div>
                </div>
            </div>
            <div class="field top-padding middle-align">
                <nav>
                    <div class="max">
                        <h6>Darkmode</h6>
                        <div>Enable dark mode</div>
                    </div>
                    <label class="switch icon">
                        <input type="checkbox" id="toggle-mode" autocomplete="off">
                        <span>
                            <i>dark_mode</i>
                        </span>
                    </label>
                </nav>
            </div>
            <nav class="right-align">
                <button class="transparent link small-round" onclick="ui('#set-theme-dialog')">
                    <span>Close</span>
                </button>
            </nav>
        </dialog>
        `.trim();

        this.dialog = template.content.firstElementChild as HTMLDialogElement;

        // Initialize dialog
        this.init();
    }

    async init() {
        let lastWidth = window.innerWidth;
        this.adjustDialogForScreenSize();
        window.addEventListener('resize', () => {
            const currentWidth = window.innerWidth;
            if (currentWidth !== lastWidth) {
                this.adjustDialogForScreenSize();
                lastWidth = currentWidth;
            }
        });

        const toggleModeButton = this.dialog.querySelector("#toggle-mode") as HTMLInputElement;
        toggleModeButton.checked = await appSettings.getSetting("mode", "dark") === "dark";

        toggleModeButton.addEventListener("change", () => {
            const newMode = toggleModeButton.checked ? "dark" : "light";
            setMode(newMode);
        });

        const themeButtons = this.dialog.querySelectorAll("#theme-button") as NodeListOf<HTMLButtonElement>;
        themeButtons.forEach(button => {
            button.addEventListener("click", () => {
                const color = button.dataset.color as string;
                setTheme(color);
            });
        });

        const selectColorInput = this.dialog.querySelector("#select-color") as HTMLInputElement;
        selectColorInput.addEventListener("change", () => {
            const color = selectColorInput.value;
            setTheme(color);
        });
    }

    public attachTo(parent: HTMLElement = document.body) {
        parent.appendChild(this.dialog);
    }

    adjustDialogForScreenSize() {
        if (window.innerWidth <= 600) {
            this.dialog.classList.remove('right');
            this.dialog.classList.add('max');
        } else {
            this.dialog.classList.add('right');
            this.dialog.classList.remove('max');
        }
    }
}
