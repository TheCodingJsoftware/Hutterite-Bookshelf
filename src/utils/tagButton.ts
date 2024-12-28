import { Books, Subjects } from "./tags";

export class TagButton {
    private tag: Books| Subjects;
    private tagButton: HTMLButtonElement;
    private unselectButton: HTMLButtonElement;
    tagName: string;
    tagID: string;

    constructor(tag: Books | Subjects) {
        this.tag = tag;
        this.tagID = this.tag.valueOf().toLowerCase().replace(/_/g, "-").replace(/ /g, "-");
        this.tagName = this.tag.toString();
        let iconName = "";

        if (Object.values(Subjects).includes(this.tag as Subjects)) {
            iconName = "notes";
        } else if (Object.values(Books).includes(this.tag as Books)) {
            iconName = "book";
        }

        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
        <button id="${this.tagID}" class="tag-button round chip tiny-margin left-align" data-name="${this.tagName}">
            <i>${iconName}</i>
            <span>${this.tagName}</span>
            <a id="unselect-button" class="transparent none badge hidden no-padding">
                <i>close</i>
            </a>
        </button>
        `.trim();
        this.tagButton = template.content.firstElementChild as HTMLButtonElement;

        this.unselectButton = this.tagButton.querySelector("#unselect-button") as HTMLButtonElement;
        this.tagButton.onclick = () => this.select();
        this.unselectButton.onclick = () => this.unselect();
        this.setTagStateFromLocalStorage();
    }

    setTagStateFromLocalStorage() {
        const key = `tag-${this.tagID}`;
        const isSelected = localStorage.getItem(key);
        if (isSelected === "true") {
            this.tagButton.classList.add("fill");
            this.unselectButton.classList.remove("hidden");
            this.tagButton.disabled = true;
        }
    }

    saveTagStateToLocalStorage() {
        const key = `tag-${this.tagID}`;
        localStorage.setItem(key, this.isSelected().toString());
    }

    select() {
        this.tagButton.classList.add("fill");
        this.unselectButton.classList.remove("hidden");
        this.tagButton.disabled = true;
        this.saveTagStateToLocalStorage();
    }

    unselect() {
        this.tagButton.classList.remove("fill");
        this.unselectButton.classList.add("hidden");
        this.tagButton.disabled = false;
        this.saveTagStateToLocalStorage();
    }

    isSelected() {
        return this.tagButton.classList.contains("fill");
    }

    getButton() {
        return this.tagButton;
    }
}