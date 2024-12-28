import 'beercss';
import 'material-dynamic-colors';
import '../static/css/style.css';
import { loadTheme, loadAnimationStyleSheet } from "./utils/theme";

async function loadUIComponents() {
    try {
        const [themeDialogModule] = await Promise.all([
            import("./dialogs/themeDialog"),
        ]);

        const { SetThemeDialog } = themeDialogModule;

        const setThemeDialog = new SetThemeDialog();
        setThemeDialog.attachTo();
    } catch (error) {
        console.error("Error loading UI components:", error);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    loadTheme().then(() => {
        setTimeout(() => {
            loadAnimationStyleSheet();
        }, 100);
    }).catch(error => console.error('Failed to load theme:', error));
    await loadUIComponents();
});
