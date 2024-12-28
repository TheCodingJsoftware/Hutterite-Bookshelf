import { Subjects } from "../utils/tags";

export class SubjectButton {
    private subject: Subjects;
    private button: HTMLButtonElement;
    private subjectName: string;
    private subjectID: string;

    constructor(subject: Subjects) {
        this.subject = subject;
        this.subjectID = this.subject.valueOf().toLowerCase().replace(/_/g, "-").replace(/ /g, "-");
        this.subjectName = this.subject.toString();
        const template = document.createElement('template') as HTMLTemplateElement;
        template.innerHTML = `
        <button id="${this.subjectID}" class="tiny-margin left-align small-round link border subject-button l3 m4 s6" data-name="${this.subjectName}">
            <i>notes</i>
            <span class="small-text">${this.subjectName}</span>
        </button>
        `.trim();

        this.button = template.content.firstElementChild as HTMLButtonElement;
        this.button.onclick = () => window.location.hash = `#${this.subjectID}`;
    }
    getButton() {
        return this.button;
    }
}