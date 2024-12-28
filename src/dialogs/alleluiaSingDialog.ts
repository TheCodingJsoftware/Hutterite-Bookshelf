import { BookTemplateDialog } from "./bookTemplateDialog";

export class AlleluiaSingDialog extends BookTemplateDialog  {
    constructor() {
        super("Alleluia Sing");
    }

    public attachTo(parent: HTMLElement = document.body) {
        parent.appendChild(this.dialog);
    }
}
