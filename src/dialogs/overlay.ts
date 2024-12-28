export class Overlay {
    private overlay: HTMLDivElement;

    constructor() {
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
            <div class="overlay blur"></div>
        `.trim();

        this.overlay = template.content.firstElementChild as HTMLDivElement;
        this.overlay.addEventListener("click", () => {
            this.hideOverlay();
            window.location.hash = "";
        });
    }

    public showOverlay() {
        this.overlay.classList.add('active');
    }

    public hideOverlay() {
        this.overlay.classList.remove('active');
    }

    public attachTo(parent: HTMLElement = document.body) {
        parent.appendChild(this.overlay);
    }
}