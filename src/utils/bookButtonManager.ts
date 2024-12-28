import { AlleluiaSingDialog } from "../dialogs/alleluiaSingDialog";
import { AlleluiaSing } from '../books/alleluiaSing';

export class BookButtonManager {
    private alleluiaSingDialog: AlleluiaSingDialog | undefined;

    openAlleluiaSingDialog(){
        if (!this.alleluiaSingDialog) {
            this.alleluiaSingDialog = new AlleluiaSingDialog();
            this.alleluiaSingDialog.attachTo();
        }
        this.alleluiaSingDialog.open();
    }

    closeAlleluiaSingDialog(){
        if (!this.alleluiaSingDialog) {
            return;
        }
        this.alleluiaSingDialog.close();
    }

    closeAllDialogs(){
        this.closeAlleluiaSingDialog();
        window.location.hash = "";
    }
}