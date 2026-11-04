import { ui } from './ui.js';
import { i18n } from './i18n.js';

function syncLangSwitch() {
    document.documentElement.lang = i18n.currentLang;
    document.querySelectorAll('.lang-opt').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.lang === i18n.currentLang));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lang-opt').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.lang === i18n.currentLang) return;
            i18n.setLang(btn.dataset.lang);
            syncLangSwitch();
            ui.applyTranslations();
            ui.renderSlotRule();
            ui.syncThemeColor();
            ui.updateDateDisplay();
            ui.renderAll();
        };
    });
    syncLangSwitch();
    ui.applyTranslations();
    ui.syncThemeColor();
});
