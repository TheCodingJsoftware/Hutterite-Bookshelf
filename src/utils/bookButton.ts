import { Books } from "../utils/tags";

export class BookButton {
    private book: Books;
    private button: HTMLButtonElement;
    private bookName: string;
    private bookID: string;

    constructor(book: Books) {
        this.book = book;
        this.bookID = this.book.valueOf().toLowerCase().replace(/_/g, "-").replace(/ /g, "-");
        this.bookName = this.book.toString();
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
        <button id="${this.bookID}" class="tiny-margin left-align small-round link border book-button l3 m4 s6" data-name="${this.bookName}">
            <i>book</i>
            <span class="small-text">${this.bookName}</span>
        </button>
        `.trim();

        this.button = template.content.firstElementChild as HTMLButtonElement;
        this.button.onclick = () => window.location.hash = `#${this.bookID}`;
    }

    getButton() {
        return this.button;
    }
}