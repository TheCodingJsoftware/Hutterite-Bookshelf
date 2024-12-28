import 'beercss';
import 'material-dynamic-colors';
import '../static/css/style.css';
import { loadTheme, loadAnimationStyleSheet } from "./utils/theme";

interface HTMLButtonElement {
    innerHTML: string;
    audio?: HTMLAudioElement | null;
    audioCtx?: AudioContext | null;
}

export function playaudio(filename: string, button: HTMLButtonElement) {
    if (button.audio) {
        button.audio.pause();
        button.audio.currentTime = 0;
        if (button.audioCtx){
            button.audioCtx.close();
        }
        button.audio = null;
        button.audioCtx = null;
        button.innerHTML = '<i>play_arrow</i>';
        return;
    }

    // Create new audio and AudioContext instances
    const audio = new Audio(`/static/audio/${filename}.mp3`);
    const audioCtx = new (window.AudioContext || window.AudioContext)();
    const gainNode = audioCtx.createGain();

    // Associate the audio and AudioContext instances with the button
    button.audio = audio;
    button.audioCtx = audioCtx;

    // Update the button to show "stop"
    button.innerHTML = '<i>stop</i>';

    audio.addEventListener('canplaythrough', () => {
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        gainNode.gain.value = 20;
        audio.play();
    });

    audio.addEventListener('ended', () => {
        if (button.audio) {
            button.audio.pause();
            button.audio.currentTime = 0;
            button.audio = null;
        }
        if (button.audioCtx) {
            button.audioCtx.close();
            button.audioCtx = null;
        }
        button.innerHTML = '<i>play_arrow</i>';
    });

    audio.addEventListener('error', () => {
        console.error(`Error playing audio file: ${filename}`);
        if (button.audio) {
            button.audio.pause();
            button.audio.currentTime = 0;
            button.audio = null;
        }
        if (button.audioCtx) {
            button.audioCtx.close();
            button.audioCtx = null;
        }
        button.innerHTML = '<i>play_arrow</i>';
    });
}

if (typeof window !== 'undefined') {
    (window as any).playaudio = playaudio;
}

document.addEventListener("DOMContentLoaded", () => {
    const languageSwitchCheckbox = document.getElementById("language-switch-checkbox") as HTMLInputElement;
    const alwaysOpenCheckbox = document.getElementById("always-open-checkbox") as HTMLInputElement;
    const translateCheckboxes = document.querySelectorAll(".translate-checkbox") as NodeListOf<HTMLInputElement>;

    // Toggle language globally
    languageSwitchCheckbox.addEventListener("change", (e) => {
        const isGerman = languageSwitchCheckbox.checked;
        const germanElements = document.querySelectorAll(".german") as NodeListOf<HTMLElement>;
        const englishElements = document.querySelectorAll(".english") as NodeListOf<HTMLElement>;

        germanElements.forEach((el) => el.style.display = !isGerman
                ? "block"
                : "none");
        englishElements.forEach((el) => el.style.display = !isGerman
                ? "none"
                : "block");
        translateCheckboxes.forEach((checkbox) => {
            checkbox.checked = isGerman; // Set to English if not German
        });
    });

    // Toggle translation for individual questions
    translateCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
            const questionId = checkbox.dataset.question;
            const isGerman = !checkbox.checked;

            const germanQuestion = document.getElementById(`german-question-${questionId}`) as HTMLDivElement;
            const englishQuestion = document.getElementById(`english-question-${questionId}`) as HTMLDivElement;
            const germanAnswer = document.getElementById(`german-answer-${questionId}`) as HTMLDivElement;
            const englishAnswer = document.getElementById(`english-answer-${questionId}`) as HTMLDivElement;
            const germanReference = document.getElementById(`german-reference-${questionId}`) as HTMLDivElement;
            const englishReference = document.getElementById(`english-reference-${questionId}`) as HTMLDivElement;

            germanQuestion.style.display = isGerman ? "block" : "none";
            englishQuestion.style.display = isGerman ? "none" : "block";
            germanAnswer.style.display = isGerman ? "block" : "none";
            englishAnswer.style.display = isGerman ? "none" : "block";
            germanReference.style.display = isGerman ? "block" : "none";
            englishReference.style.display = isGerman ? "none" : "block";
        });
    });

    // Always open questions functionality
    alwaysOpenCheckbox.addEventListener("change", () => {
        const open = alwaysOpenCheckbox.checked;
        document
            .querySelectorAll("details")
            .forEach((detail) => {
                detail.open = open;
            });
    });
});


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
