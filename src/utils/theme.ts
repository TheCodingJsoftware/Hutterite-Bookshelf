import { SettingsManager } from "./settings";

export const appSettings = new SettingsManager();
export let savedTheme: string = "#f9abff";
export let savedMode: string = "dark";


function hexToRgb(hex: string): [number, number, number] {
    hex = hex.replace(/^#/, '');

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h: number = 0;
    let s: number = (max === 0 ? 0 : diff / max);
    let l: number = (max + min) / 2;

    if (diff === 0) {
        h = 0;
    } else {
        switch (max) {
            case r:
                h = (g - b) / diff + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / diff + 2;
                break;
            case b:
                h = (r - g) / diff + 4;
                break;
        }
        h /= 6;
    }

    return [h * 360, s * 100, l * 100];
}

function checkLogos(){
    const [r, g, b] = hexToRgb(savedTheme);
    const [hue, saturation, lightness] = rgbToHsl(r, g, b);
    const hueRotateValue = `${hue}deg`;
    const logos = document.querySelectorAll(".logo") as NodeListOf<HTMLImageElement>;
    logos.forEach(logo => {
        logo.style.filter = `invert(${savedMode === "light" ? "1" : "0"}) hue-rotate(${hueRotateValue})`;
    });

}

export async function loadTheme() {
    document.body.style.display = 'none';

    const [theme, mode] = await Promise.all([
        appSettings.getSetting("theme", "#f9abff"),
        appSettings.getSetting("mode", "dark"),
    ]);

    savedMode = mode as string;
    savedTheme = theme as string;

    ui("mode", mode);
    ui("theme", theme);

    checkLogos();

    document.body.style.removeProperty('display');
}

export function setTheme(color: string) {
    appSettings.saveSetting("theme", color);
    savedTheme = color;
    ui("theme", color);
}

export function setMode(mode: string) {
    appSettings.saveSetting("mode", mode);
    savedMode = mode;
    ui("mode", mode);

    checkLogos();
}

export function loadAnimationStyleSheet() {
    const style = document.createElement("style");
    style.textContent = `
    html,
    body,
    div,
    article,
    p,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    ul,
    li,
    span,
    a,
    button,
    input,
    textarea,
    select,
    details,
    summary,
    footer,
    blockquote,
    pre,
    code,
    .field {
        transition: background-color var(--speed3) ease-in-out, color var(--speed1) ease;
    }
    dialog{
        transition: background-color var(--speed3) ease-in-out, color var(--speed1) ease, all var(--speed3);
    }
  `.trim();
    document.head.appendChild(style);
}
