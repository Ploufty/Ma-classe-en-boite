// Réglages d'affichage partagés avec le portail Apps1D76 (clé « apps1d-prefs ») :
// thème clair / sombre, contraste renforcé, taille du texte, animations réduites.
(() => {
    'use strict';
    const d = document, root = d.documentElement, KEY = 'apps1d-prefs';
    const lire = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    const mq = q => window.matchMedia && matchMedia(q).matches;
    const p = lire();
    root.dataset.theme = p.theme === 'dark' || (p.theme !== 'light' && mq('(prefers-color-scheme: dark)')) ? 'dark' : 'light';
    root.dataset.motion = p.motion === 'reduce' || (p.motion !== 'on' && mq('(prefers-reduced-motion: reduce)')) ? 'reduce' : 'full';
    root.dataset.contrast = p.contrast === true ? 'high' : 'normal';
    root.style.setProperty('--text-scale', ({ 115: 1.15, 130: 1.3 })[p.text] || 1);

    d.addEventListener('DOMContentLoaded', () => {
        const btn = d.getElementById('theme-toggle'), meta = d.querySelector('meta[name="theme-color"]');
        const maj = () => {
            const dark = root.dataset.theme === 'dark';
            btn?.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
            if (meta) meta.content = dark ? '#11111b' : '#000091';
        };
        btn?.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            const prefs = lire(); prefs.theme = root.dataset.theme;   // les autres réglages du portail sont conservés
            try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* navigation privée */ }
            maj();
        });
        maj();
    });
    // Étape repliable : <button class="step-header" aria-expanded="true|false"> suivi de son .step-body
    d.addEventListener('click', e => {
        const h = e.target.closest?.('.step-header');
        if (h) h.setAttribute('aria-expanded', h.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
})();
