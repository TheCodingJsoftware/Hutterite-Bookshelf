import 'beercss';
import 'material-dynamic-colors';
import '../static/css/style.css';
import { loadTheme, loadAnimationStyleSheet } from "./utils/theme";


document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    setTimeout(() => {
        loadAnimationStyleSheet();
    }, 100);
});