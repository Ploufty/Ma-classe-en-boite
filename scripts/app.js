(function () {
    'use strict';

    var STORAGE_ELEVES = 'gestionClasse_eleves';
    var STORAGE_REGLAGES = 'gestionClasse_reglages';
    var NIVEAUX_ORDRE = { 'PS': 1, 'MS': 2, 'GS': 3, 'CP': 4, 'CE1': 5, 'CE2': 6, 'CM1': 7, 'CM2': 8 };
    var NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    var NOMS_MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    var JOURS_SEMAINE = [
        { cle: 'lundi', label: 'Lun' },
        { cle: 'mardi', label: 'Mar' },
        { cle: 'mercredi', label: 'Mer' },
        { cle: 'jeudi', label: 'Jeu' },
        { cle: 'vendredi', label: 'Ven' }
    ];
    var PALETTE_GROUPES = [
        '#A8C7FA', '#F6A6A0', '#A8E0C0', '#FBC98A', '#C9B3F0', '#8FE0DC', '#F4A8C8', '#B8C4D8',
        '#B8E0A0', '#F0D080', '#F0B080', '#A0D0F0', '#D0A8E0', '#90D8B8'
    ];
    var MAX_GROUPES = PALETTE_GROUPES.length;
    var EXEMPLES_NOTES = [
        { emoji: '🖨️', texte: 'Code photocopieuse : 1234' },
        { emoji: '🔐', texte: 'Code portail : 5678' },
        { emoji: '⏰', texte: 'Récréation : 10h00 - 10h15' }
    ];
    var EMOJIS_ECOLE = [
        '📚', '📖', '✏️', '🖍️', '📏', '🎒', '🏫', '🔔',
        '🖨️', '🔐', '⏰', '📅', '🍽️', '🚌', '⚽', '🎨',
        '🧮', '🩹', '📌', '⚠️', '🔑', '💡', '📞', '🚪'
    ];

    // affichage : 'nomPrenom' | 'prenomNom' | 'prenom' ; tri : 'nom' | 'prenom' ; colonnesVides : null = valeur du type.
    // perso : options de la liste personnalisée (colonnes choisies, 2 exemplaires, ligne vierge au-dessus des en-têtes).
    var POINTAGE_DEFAUT = { type: 'generale', titre: '', lignesVides: 2, affichage: 'nomPrenom', tri: 'nom', parNiveau: false, colonnesVides: null, orientation: 'portrait',
        perso: { colonnes: ['num', 'presence'], deuxExemplaires: false, enteteVierge: true, colonnesVides: null } };
    var MAX_COLONNES_VIDES = 8;
    var MAX_LIGNES_VIDES = 15;

    var state = {
        eleves: [],
        activeTab: 'liste',
        tri: { champ: null, direction: 'asc' },
        nbGroupes: 4,
        nomsGroupes: [],
        couleursGroupes: [],
        notes: null,
        apcSeances: [],
        pointage: Object.assign({}, POINTAGE_DEFAUT),
        plan: null    // créé au chargement (normaliserPlan), une fois ses constantes définies
    };

    function nouveauGarderieJours() {
        var j = {};
        JOURS_SEMAINE.forEach(function (jour) { j[jour.cle] = { matin: false, apresmidi: false }; });
        return j;
    }

    function nouvelEleve(champs) {
        return Object.assign({
            id: uid(), nom: '', prenom: '', dateNaissance: '', genre: 'F', niveau: 'CP',
            pai: false, paiDetail: '', aesh: false, aeshJours: nouveauGarderieJours(),
            groupe: null,
            cantine: false, cantineSansViande: false, cantineSansPorc: false,
            allergie: '', remarque: '',
            garderie: false, garderieJours: nouveauGarderieJours()
        }, champs);
    }

    function trouverEleve(id) {
        return state.eleves.find(function (e) { return e.id === id; });
    }

    // Compatibilité : d'anciennes notes enregistrées comme simples chaînes deviennent des objets {emoji, texte}.
    function normaliserNotes(notes) {
        return notes.map(function (n) { return typeof n === 'string' ? { emoji: '', texte: n } : n; });
    }

    function bornerLignesVides(v) {
        return Math.max(0, Math.min(MAX_LIGNES_VIDES, parseInt(v, 10) || 0));
    }

    function nomGroupe(i) { return state.nomsGroupes[i] || ('Groupe ' + (i + 1)); }
    function couleurGroupe(i) { return state.couleursGroupes[i] || PALETTE_GROUPES[i % PALETTE_GROUPES.length]; }

    // ---------- Utilitaires ----------

    function $(id) { return document.getElementById(id); }

    function uid() {
        return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function escapeHtml(texte) {
        if (texte === undefined || texte === null) return '';
        return String(texte)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function nomComplet(el) {
        return el.nom ? el.nom.toUpperCase() + ' ' + el.prenom : el.prenom;
    }

    function aujourdHuiISO() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function telecharger(contenu, type, extension) {
        var url = URL.createObjectURL(new Blob([contenu], { type: type }));
        var lien = document.createElement('a');
        lien.href = url;
        lien.download = 'classe_' + new Date().toISOString().slice(0, 10) + '.' + extension;
        document.body.appendChild(lien);
        lien.click();
        document.body.removeChild(lien);
        URL.revokeObjectURL(url);
    }

    function formatDateFR(iso) {
        if (!iso) return '';
        var p = iso.split('-');
        if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
        return iso;
    }

    // Convertit une date saisie/importée (yyyy-mm-dd ou dd/mm/yyyy) vers l'ISO yyyy-mm-dd utilisé en interne.
    function normaliserDateISO(texte) {
        if (!texte) return '';
        texte = texte.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) return texte;
        var m = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            var j = m[1].padStart(2, '0');
            var mo = m[2].padStart(2, '0');
            return m[3] + '-' + mo + '-' + j;
        }
        return texte;
    }

    function dateVersObjet(iso) {
        if (!iso) return null;
        var p = iso.split('-');
        if (p.length !== 3) return null;
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return isNaN(d.getTime()) ? null : d;
    }

    var REGEX_DIACRITIQUES = new RegExp('[̀-ͯ]', 'g');

    function normaliserTexte(texte) {
        return (texte || '')
            .toString()
            .normalize('NFD').replace(REGEX_DIACRITIQUES, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    // ---------- Persistance ----------

    function sauvegarder() {
        try {
            localStorage.setItem(STORAGE_ELEVES, JSON.stringify(state.eleves));
            localStorage.setItem(STORAGE_REGLAGES, JSON.stringify({
                nbGroupes: state.nbGroupes,
                nomsGroupes: state.nomsGroupes,
                couleursGroupes: state.couleursGroupes,
                notes: state.notes,
                apcSeances: state.apcSeances,
                pointage: state.pointage,
                plan: state.plan
            }));
        } catch (e) {}
    }

    function charger() {
        try {
            var eleves = localStorage.getItem(STORAGE_ELEVES);
            if (eleves) state.eleves = JSON.parse(eleves) || [];
        } catch (e) {}
        try {
            var reglages = localStorage.getItem(STORAGE_REGLAGES);
            if (reglages) {
                var r = JSON.parse(reglages) || {};
                if (r.nbGroupes) state.nbGroupes = r.nbGroupes;
                if (r.nomsGroupes) state.nomsGroupes = r.nomsGroupes;
                if (r.couleursGroupes) state.couleursGroupes = r.couleursGroupes;
                if (r.notes) state.notes = r.notes;
                if (r.apcSeances) state.apcSeances = r.apcSeances;
                if (r.pointage) state.pointage = Object.assign({}, state.pointage, r.pointage);
                if (r.plan) state.plan = normaliserPlan(r.plan);
            }
        } catch (e) {}
        // Première utilisation : on amorce le pense-bête avec des exemples plutôt que de le laisser vide.
        state.notes = normaliserNotes(state.notes || EXEMPLES_NOTES.slice());
        state.plan = normaliserPlan(state.plan);
    }

    // ---------- Modale (confirmation / saisie) ----------

    var modalRoot = $('modalRoot');
    var dernierFocus = null;

    function fermerModale() {
        modalRoot.innerHTML = '';
        if (dernierFocus && typeof dernierFocus.focus === 'function') dernierFocus.focus();
    }

    // Ouvre une modale : contenu HTML + boutons d'action. Sans libelleAnnuler, pas de bouton Annuler.
    function ouvrirModale(contenu, libelleConfirmer, options) {
        options = options || {};
        dernierFocus = document.activeElement;
        modalRoot.innerHTML =
            '<div class="modaleOverlay" id="overlayModale">' +
            '  <div class="modaleBox' + (options.large ? ' large' : '') + '" role="dialog" aria-modal="true">' +
            contenu +
            '    <div class="modaleActions">' +
            (options.libelleAnnuler ? '      <button type="button" class="btnAnnuler" id="btnModaleAnnuler">' + options.libelleAnnuler + '</button>' : '') +
            '      <button type="button" class="btnConfirmer' + (options.rouge ? '' : ' bleu') + '" id="btnModaleConfirmer">' + escapeHtml(libelleConfirmer) + '</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        if (options.libelleAnnuler) $('btnModaleAnnuler').addEventListener('click', fermerModale);
        $('overlayModale').addEventListener('click', function (e) { if (e.target.id === 'overlayModale') fermerModale(); });
        $('btnModaleConfirmer').focus();
        return $('btnModaleConfirmer');
    }

    function showConfirm(titre, message, onOui, options) {
        options = options || {};
        ouvrirModale('<h3>' + escapeHtml(titre) + '</h3><p>' + escapeHtml(message) + '</p>',
            options.libelleConfirmer || 'Confirmer', { libelleAnnuler: 'Annuler', rouge: !options.bleu })
            .addEventListener('click', function () { fermerModale(); onOui(); });
    }

    function showPrompt(titre, message, valeurDefaut, onValider) {
        var btn = ouvrirModale('<h3>' + escapeHtml(titre) + '</h3><p>' + escapeHtml(message) + '</p>' +
            '<input type="text" id="inputModale" value="' + escapeHtml(valeurDefaut || '') + '">',
            'Valider', { libelleAnnuler: 'Annuler' });
        var input = $('inputModale');
        function valider() {
            var v = input.value.trim();
            fermerModale();
            if (v) onValider(v);
        }
        btn.addEventListener('click', valider);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') valider(); });
        input.focus();
        input.select();
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modalRoot.innerHTML) fermerModale();
    });

    // ---------- Formulaire d'ajout ----------

    function initGroupeBoutons(conteneurId, selecteurBtn) {
        var conteneur = $(conteneurId);
        conteneur.addEventListener('click', function (e) {
            var btn = e.target.closest(selecteurBtn);
            if (!btn) return;
            conteneur.querySelectorAll(selecteurBtn).forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            conteneur.dataset.value = btn.dataset.value;
        });
    }

    initGroupeBoutons('genreToggle', '.toggleBtn');

    $('niveauSelect').addEventListener('change', function () {
        var champPerso = $('niveauPerso');
        if ($('niveauSelect').value === 'Autre') {
            champPerso.hidden = false;
            champPerso.focus();
        } else {
            champPerso.hidden = true;
        }
    });

    $('chkPai').addEventListener('change', function () {
        var champ = $('paiDetail');
        if ($('chkPai').checked) {
            champ.hidden = false;
            champ.focus();
        } else {
            champ.hidden = true;
            champ.value = '';
        }
    });

    $('formEleve').addEventListener('submit', function (e) {
        e.preventDefault();
        var nom = $('nom').value.trim();
        var prenom = $('prenom').value.trim();
        var dateNaissance = $('dateNaissance').value;
        if (!prenom || !dateNaissance) return;

        var genre = $('genreToggle').dataset.value || 'F';
        var niveau = $('niveauSelect').value || 'CP';
        if (niveau === 'Autre') {
            var perso = $('niveauPerso').value.trim();
            niveau = perso || 'Autre';
        }

        state.eleves.push(nouvelEleve({
            nom: nom, prenom: prenom, dateNaissance: dateNaissance, genre: genre, niveau: niveau,
            pai: $('chkPai').checked, paiDetail: $('paiDetail').value.trim(), aesh: $('chkAesh').checked
        }));
        sauvegarder();

        $('nom').value = '';
        $('prenom').value = '';
        $('dateNaissance').value = '';
        $('chkPai').checked = false;
        $('chkAesh').checked = false;
        $('paiDetail').value = '';
        $('paiDetail').hidden = true;
        $('niveauSelect').value = 'CP';
        $('niveauPerso').value = '';
        $('niveauPerso').hidden = true;
        $('prenom').focus();

        render();
    });

    // ---------- Onglets ----------

    var tabBar = document.querySelector('.tabBar');
    tabBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.tabBtn');
        if (!btn) return;
        switchTab(btn.dataset.tab);
    });

    function switchTab(tab) {
        state.activeTab = tab;
        document.querySelectorAll('.tabBtn').forEach(function (b) {
            var actif = b.dataset.tab === tab;
            b.classList.toggle('active', actif);
            b.setAttribute('aria-selected', actif ? 'true' : 'false');
        });
        document.querySelectorAll('.tabPanel').forEach(function (p) {
            p.classList.toggle('active', p.id === 'panel-' + tab);
        });
        // Pointage et plan de classe ont leur propre bouton d'impression.
        $('barrePdfOnglet').style.display = (tab === 'pointage' || tab === 'plan') ? 'none' : '';
        render();
    }

    $('btnPdfOnglet').addEventListener('click', function () { lancerImpressionSections([state.activeTab]); });

    function render() {
        switch (state.activeTab) {
            case 'liste': renderListe(); break;
            case 'pyramide': renderPyramide(); break;
            case 'anniversaires': renderAnniversaires(); break;
            case 'groupes': renderGroupes(); break;
            case 'cantine': renderCantine(); break;
            case 'autres': renderAutres(); break;
            case 'apc': renderApc(); break;
            case 'pointage': renderPointage(); break;
            case 'plan': renderPlanClasse(); break;
        }
    }

    // Version imprimable (PDF) d'un onglet dont l'affichage écran est fait de champs éditables.
    function tableImpression(entetes, lignes) {
        return '<table class="tablePointage tableImpression print-only"><thead><tr>' +
            entetes.map(function (e) { return '<th>' + e + '</th>'; }).join('') + '</tr></thead><tbody>' +
            lignes.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
            '</tbody></table>';
    }

    // Résumé des demi-journées cochées : « Lun matin + soir · Mar matin ».
    function resumeJours(jours, libelleApresMidi) {
        if (!jours) return '';
        return JOURS_SEMAINE.map(function (j) {
            var d = jours[j.cle] || {};
            var creneaux = (d.matin ? ['matin'] : []).concat(d.apresmidi ? [libelleApresMidi] : []);
            return creneaux.length ? j.label + ' ' + creneaux.join(' + ') : '';
        }).filter(Boolean).join(' · ');
    }

    function elevesVides(message) {
        return '<div class="emptyState"><span class="emptyIcon" aria-hidden="true">🧑‍🎓</span>' + escapeHtml(message) + '</div>';
    }

    // ---------- Vue Liste ----------

    function comparerChamp(a, b, champ) {
        if (champ === 'dateNaissance') {
            var da = dateVersObjet(a.dateNaissance), db = dateVersObjet(b.dateNaissance);
            return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
        }
        if (champ === 'niveau') {
            var na = NIVEAUX_ORDRE[a.niveau] || 99, nb = NIVEAUX_ORDRE[b.niveau] || 99;
            return na - nb;
        }
        var va = (a[champ] || '').toString().toLowerCase();
        var vb = (b[champ] || '').toString().toLowerCase();
        if (va < vb) return -1;
        if (va > vb) return 1;
        return 0;
    }

    function elevesTries() {
        var arr = state.eleves.slice();
        if (state.tri.champ) {
            var dir = state.tri.direction === 'asc' ? 1 : -1;
            arr.sort(function (a, b) { return comparerChamp(a, b, state.tri.champ) * dir; });
        }
        return arr;
    }

    function optionsNiveaux(niveauActuel) {
        var niveaux = Object.keys(NIVEAUX_ORDRE);
        if (niveaux.indexOf(niveauActuel) === -1 && niveauActuel !== 'Autre') niveaux.push(niveauActuel);
        return niveaux.map(function (n) {
            return '<option value="' + escapeHtml(n) + '"' + (n === niveauActuel ? ' selected' : '') + '>' + escapeHtml(n) + '</option>';
        }).join('') + '<option value="__autre__">Autre…</option>';
    }

    function classeTri(champ) {
        return state.tri.champ === champ ? ' sortable ' + state.tri.direction : ' sortable';
    }

    function renderListe() {
        var panel = $('panel-liste');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Aucun élève enregistré. Ajoutez votre premier élève ci-dessus.');
            return;
        }
        var lignes = elevesTries().map(function (el, i) {
            return '<tr>' +
                '<td><input type="text" class="editInput" data-id="' + el.id + '" data-field="nom" value="' + escapeHtml(el.nom || '') + '"></td>' +
                '<td><input type="text" class="editInput" data-id="' + el.id + '" data-field="prenom" value="' + escapeHtml(el.prenom) + '"></td>' +
                '<td><div class="genreToggle" data-id="' + el.id + '">' +
                '  <button type="button" class="genreBtn F' + (el.genre === 'F' ? ' active' : '') + '" data-genre="F">F</button>' +
                '  <button type="button" class="genreBtn M' + (el.genre === 'M' ? ' active' : '') + '" data-genre="M">M</button>' +
                '</div></td>' +
                '<td><input type="date" class="editInput" data-id="' + el.id + '" data-field="dateNaissance" value="' + escapeHtml(el.dateNaissance) + '"></td>' +
                '<td><select class="editSelect" data-id="' + el.id + '" data-field="niveau">' + optionsNiveaux(el.niveau) + '</select></td>' +
                '<td style="text-align:center;">' +
                '<input type="checkbox" data-id="' + el.id + '" data-field="pai"' + (el.pai ? ' checked' : '') + '>' +
                (el.pai ? '<input type="text" class="editInput" style="margin-top:4px; min-width:140px;" data-id="' + el.id + '" data-field="paiDetail" value="' + escapeHtml(el.paiDetail || '') + '" placeholder="Précisions…">' : '') +
                '</td>' +
                '<td style="text-align:center;"><input type="checkbox" data-id="' + el.id + '" data-field="aesh"' + (el.aesh ? ' checked' : '') + '></td>' +
                '<td class="no-print"><button type="button" class="btnSupprimer" data-id="' + el.id + '" title="Supprimer" aria-label="Supprimer">✕</button></td>' +
                '</tr>';
        }).join('');

        panel.innerHTML =
            '<div class="panelHeader"><h2 style="margin:0;">Liste de la classe</h2><span class="countBadge">' + state.eleves.length + (state.eleves.length > 1 ? ' élèves' : ' élève') + '</span></div>' +
            '<div class="tableWrap no-print"><table class="listeTable"><thead><tr>' +
            '<th class="' + classeTri('nom') + '" data-sort="nom">Nom</th>' +
            '<th class="' + classeTri('prenom') + '" data-sort="prenom">Prénom</th>' +
            '<th class="' + classeTri('genre') + '" data-sort="genre">Genre</th>' +
            '<th class="' + classeTri('dateNaissance') + '" data-sort="dateNaissance">Naissance</th>' +
            '<th class="' + classeTri('niveau') + '" data-sort="niveau">Niveau</th>' +
            '<th>PAI</th><th>AESH</th><th class="no-print">Actions</th>' +
            '</tr></thead><tbody>' + lignes + '</tbody></table></div>' +
            tableImpression(['N°', 'Nom', 'Prénom', 'Genre', 'Naissance', 'Niveau', 'PAI', 'AESH'], elevesTries().map(function (el, i) {
                return [i + 1, escapeHtml((el.nom || '').toUpperCase()), escapeHtml(el.prenom), el.genre === 'M' ? 'G' : 'F',
                    formatDateFR(el.dateNaissance), escapeHtml(el.niveau), el.pai ? 'Oui' + (el.paiDetail ? ' : ' + escapeHtml(el.paiDetail) : '') : '', el.aesh ? 'Oui' : ''];
            }));

        panel.querySelectorAll('th[data-sort]').forEach(function (th) {
            th.addEventListener('click', function () {
                var champ = th.dataset.sort;
                if (state.tri.champ === champ) state.tri.direction = state.tri.direction === 'asc' ? 'desc' : 'asc';
                else { state.tri.champ = champ; state.tri.direction = 'asc'; }
                renderListe();
            });
        });

        panel.querySelectorAll('.editInput, .editSelect').forEach(function (el) {
            el.addEventListener('change', function () {
                var champ = el.dataset.field;
                var eleve = trouverEleve(el.dataset.id);
                if (!eleve) return;
                if (champ === 'niveau' && el.value === '__autre__') {
                    showPrompt('Niveau personnalisé', 'Entrez le nom du niveau :', '', function (v) {
                        eleve.niveau = v;
                        sauvegarder();
                        renderListe();
                    });
                    el.value = eleve.niveau;
                    return;
                }
                eleve[champ] = el.value;
                sauvegarder();
            });
        });

        panel.querySelectorAll('input[type="checkbox"][data-field]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var eleve = trouverEleve(cb.dataset.id);
                if (!eleve) return;
                eleve[cb.dataset.field] = cb.checked;
                sauvegarder();
                if (cb.dataset.field === 'pai') renderListe();
            });
        });

        panel.querySelectorAll('.genreToggle').forEach(function (grp) {
            grp.addEventListener('click', function (e) {
                var btn = e.target.closest('.genreBtn');
                if (!btn) return;
                var eleve = trouverEleve(grp.dataset.id);
                if (!eleve) return;
                eleve.genre = btn.dataset.genre;
                sauvegarder();
                renderListe();
            });
        });

        panel.querySelectorAll('.btnSupprimer').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var eleve = trouverEleve(btn.dataset.id);
                if (!eleve) return;
                showConfirm('Supprimer l\'élève', 'Voulez-vous vraiment supprimer ' + eleve.prenom + ' ?', function () {
                    state.eleves = state.eleves.filter(function (e) { return e.id !== eleve.id; });
                    sauvegarder();
                    render();
                });
            });
        });
    }

    // ---------- Vue Pyramide ----------

    function renderPyramide() {
        var panel = $('panel-pyramide');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Ajoutez des élèves pour visualiser la pyramide des âges.');
            return;
        }

        var parAnnee = {}, parMois = Array.from({ length: 12 }, function () { return { M: 0, F: 0 }; }), parNiveau = {};
        state.eleves.forEach(function (el) {
            var d = dateVersObjet(el.dateNaissance) || new Date();
            var annee = d.getFullYear(), mois = d.getMonth();
            if (!parAnnee[annee]) parAnnee[annee] = { M: 0, F: 0 };
            parAnnee[annee][el.genre]++;
            parMois[mois][el.genre]++;
            if (!parNiveau[el.niveau]) parNiveau[el.niveau] = { M: 0, F: 0 };
            parNiveau[el.niveau][el.genre]++;
        });

        var annees = Object.keys(parAnnee).sort();
        var maxAnnee = Math.max.apply(null, annees.map(function (a) { return Math.max(parAnnee[a].M, parAnnee[a].F); }).concat([1]));
        var lignesAnnees = annees.map(function (a) {
            var d = parAnnee[a];
            var wM = (d.M / maxAnnee) * 100, wF = (d.F / maxAnnee) * 100;
            return '<div class="pyraLigne">' +
                '<div class="pyraGauche">' + (d.M > 0 ? '<div class="pyraBarreG" style="width:' + wM + '%; min-width: 22px;">' + d.M + '</div>' : '') + '</div>' +
                '<div class="pyraLabel">' + a + '</div>' +
                '<div class="pyraDroite">' + (d.F > 0 ? '<div class="pyraBarreF" style="width:' + wF + '%; min-width: 22px;">' + d.F + '</div>' : '') + '</div>' +
                '</div>';
        }).join('');

        // Histogramme garçons/filles : series[i] = { M, F }, titres[i] pour l'infobulle, labels[i] sous la barre.
        function barresVerticales(series, titres, labels, styleBarre) {
            var max = Math.max.apply(null, series.map(function (d) { return Math.max(d.M, d.F); }).concat([1]));
            return series.map(function (d, i) {
                return '<div class="pyraMoisBarre">' +
                    '<div class="pyraMoisConteneur">' +
                    '<div class="barreG" style="height:' + (d.M / max) * 100 + '%;' + styleBarre + '" title="' + titres[i] + ' : ' + d.M + ' garçon(s)"></div>' +
                    '<div class="barreF" style="height:' + (d.F / max) * 100 + '%;' + styleBarre + '" title="' + titres[i] + ' : ' + d.F + ' fille(s)"></div>' +
                    '</div><div class="pyraMoisLabel">' + labels[i] + '</div></div>';
            }).join('');
        }

        var barresMois = barresVerticales(parMois, NOMS_MOIS, NOMS_MOIS_COURT, '');

        var niveaux = Object.keys(parNiveau).sort(function (a, b) { return (NIVEAUX_ORDRE[a] || 99) - (NIVEAUX_ORDRE[b] || 99); });
        var barresNiveau = barresVerticales(niveaux.map(function (n) { return parNiveau[n]; }), niveaux, niveaux, ' width:18px;');

        var totalG = state.eleves.filter(function (e) { return e.genre === 'M'; }).length;
        var totalF = state.eleves.filter(function (e) { return e.genre === 'F'; }).length;

        panel.innerHTML =
            '<h2 class="pyraTitre">Pyramide des âges par année</h2><div class="pyraAnnees">' + lignesAnnees + '</div>' +
            '<h2 class="pyraTitre">Répartition par mois de naissance</h2><div class="pyraMoisGrille">' + barresMois + '</div>' +
            '<h2 class="pyraTitre">Répartition par niveau de classe</h2><div class="pyraMoisGrille">' + barresNiveau + '</div>' +
            '<div class="recapPyramide">' +
            '<div class="recapItem"><span class="pastille" style="background:var(--bleu);"></span> Garçons : ' + totalG + '</div>' +
            '<div class="recapItem"><span class="pastille" style="background:var(--rouge);"></span> Filles : ' + totalF + '</div>' +
            '</div>';
    }

    // ---------- Vue Anniversaires ----------

    function renderAnniversaires() {
        var panel = $('panel-anniversaires');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Ajoutez des élèves pour afficher le calendrier des anniversaires.');
            return;
        }
        var parMois = Array.from({ length: 12 }, function () { return []; });
        state.eleves.forEach(function (el) {
            var d = dateVersObjet(el.dateNaissance) || new Date();
            parMois[d.getMonth()].push({ nomAffiche: nomComplet(el), jour: d.getDate(), genre: el.genre });
        });
        parMois.forEach(function (m) { m.sort(function (a, b) { return a.jour - b.jour; }); });

        var cartes = parMois.map(function (liste, i) {
            var corps = liste.length
                ? liste.map(function (e) {
                    return '<div class="annivItem"><span class="annivJour">' + e.jour + '</span><span class="annivNom">' + escapeHtml(e.nomAffiche) + '</span>' +
                        '<span class="annivPastille" style="background:' + (e.genre === 'M' ? 'var(--bleu)' : 'var(--rouge)') + ';"></span></div>';
                }).join('')
                : '<div class="annivVide">Aucun</div>';
            return '<div class="moisCarte"><div class="moisEntete">' + NOMS_MOIS[i] + '</div><div class="moisCorps">' + corps + '</div></div>';
        }).join('');

        panel.innerHTML = '<h2 style="margin-top:0;">Calendrier des anniversaires</h2><div class="calAnniv">' + cartes + '</div>';
    }

    // ---------- Vue Groupes ----------

    var dragEleveId = null;

    function renderGroupes() {
        var panel = $('panel-groupes');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Ajoutez des élèves pour composer des groupes.');
            return;
        }

        var nb = state.nbGroupes;
        var groupes = Array.from({ length: nb }, function () { return []; });
        var nonAssignes = [];
        state.eleves.forEach(function (el) {
            if (!el.groupe || el.groupe < 1 || el.groupe > nb) nonAssignes.push(el);
            else groupes[el.groupe - 1].push(el);
        });

        function etiquette(el, dansGroupe, couleur) {
            return '<li class="etiquetteEleve" draggable="true" data-id="' + el.id + '" style="border-left-color:' + (couleur || 'var(--bleu)') + ';">' +
                '<span class="nomEleve">' + escapeHtml(nomComplet(el)) + '</span>' +
                (dansGroupe ? '<button type="button" class="btnRetirer no-print" data-id="' + el.id + '" title="Retirer du groupe" aria-label="Retirer du groupe">✕</button>' : '') +
                '</li>';
        }

        var htmlNonAssignes = '<div class="zoneGroupe nonAssignes' + (nonAssignes.length ? '' : ' no-print') + '" data-groupe="0">' +
            '<div class="zoneGroupeTitre"><span class="nomGroupe">Élèves non assignés</span><span class="compte">' + nonAssignes.length + '</span></div>' +
            '<ul style="list-style:none; margin:0; padding:0;">' + (nonAssignes.map(function (e) { return etiquette(e, false); }).join('') || '<li class="annivVide">Aucun</li>') + '</ul>' +
            '</div>';

        var htmlGroupes = groupes.map(function (liste, i) {
            var couleur = couleurGroupe(i);
            return '<div class="zoneGroupe" data-groupe="' + (i + 1) + '">' +
                '<div class="zoneGroupeTitre">' +
                '<button type="button" class="pastilleCouleurGroupe no-print" data-groupe-index="' + i + '" style="background:' + couleur + ';" title="Changer la couleur du groupe" aria-label="Changer la couleur du groupe"></button>' +
                '<span class="nomGroupe">' + escapeHtml(nomGroupe(i)) + '</span>' +
                '<span class="compte">' + liste.length + '</span>' +
                '<button type="button" class="btnRenommerGroupe no-print" data-groupe-index="' + i + '" title="Renommer le groupe" aria-label="Renommer le groupe">✎</button>' +
                (nb > 1 ? '<button type="button" class="btnSupprimerGroupe no-print" data-groupe-index="' + i + '" title="Supprimer ce groupe" aria-label="Supprimer ce groupe">✕</button>' : '') +
                '</div>' +
                '<ul style="list-style:none; margin:0; padding:0;">' + (liste.map(function (e) { return etiquette(e, true, couleur); }).join('') || '<li class="annivVide">Vide</li>') + '</ul>' +
                '</div>';
        }).join('');

        panel.innerHTML =
            '<div class="groupesToolbar no-print">' +
            '<span class="compteurGroupes">' + nb + (nb > 1 ? ' groupes' : ' groupe') + '</span>' +
            '<button type="button" id="btnAjouterGroupe" class="softButton"' + (nb >= MAX_GROUPES ? ' disabled' : '') + '>+ Ajouter un groupe</button>' +
            '<button type="button" id="btnRegenererGroupes" class="softButton">🔀 Régénérer automatiquement</button>' +
            '</div>' +
            htmlNonAssignes +
            '<div class="grilleGroupes" style="margin-top:14px;">' + htmlGroupes + '</div>';

        $('btnAjouterGroupe').addEventListener('click', function () {
            if (state.nbGroupes >= MAX_GROUPES) return;
            state.nbGroupes++;
            sauvegarder();
            renderGroupes();
        });

        $('btnRegenererGroupes').addEventListener('click', genererGroupesEquilibres);

        panel.querySelectorAll('.btnRenommerGroupe').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.dataset.groupeIndex, 10);
                showPrompt('Renommer le groupe', 'Nouveau nom pour ce groupe :', nomGroupe(i), function (v) {
                    state.nomsGroupes[i] = v;
                    sauvegarder();
                    renderGroupes();
                });
            });
        });

        panel.querySelectorAll('.btnSupprimerGroupe').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.dataset.groupeIndex, 10);
                showConfirm('Supprimer ce groupe', 'Les élèves de « ' + nomGroupe(i) + ' » repasseront en non assignés.', function () {
                    var numero = i + 1;
                    state.eleves.forEach(function (el) {
                        if (el.groupe === numero) el.groupe = null;
                        else if (el.groupe && el.groupe > numero) el.groupe -= 1;
                    });
                    state.nomsGroupes.splice(i, 1);
                    state.couleursGroupes.splice(i, 1);
                    state.nbGroupes = Math.max(1, state.nbGroupes - 1);
                    sauvegarder();
                    renderGroupes();
                });
            });
        });

        panel.querySelectorAll('.pastilleCouleurGroupe').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var dejaOuvert = btn.parentElement.querySelector('.popoverCouleurs');
                document.querySelectorAll('.popoverCouleurs').forEach(function (p) { p.remove(); });
                if (dejaOuvert) return;
                var i = parseInt(btn.dataset.groupeIndex, 10);
                var popover = document.createElement('div');
                popover.className = 'popoverCouleurs';
                popover.innerHTML = PALETTE_GROUPES.map(function (c) {
                    return '<button type="button" style="background:' + c + ';" data-couleur="' + c + '" aria-label="Couleur ' + c + '"></button>';
                }).join('');
                popover.querySelectorAll('button').forEach(function (b) {
                    b.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        state.couleursGroupes[i] = b.dataset.couleur;
                        sauvegarder();
                        renderGroupes();
                    });
                });
                btn.parentElement.appendChild(popover);
            });
        });

        panel.querySelectorAll('.btnRetirer').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var eleve = trouverEleve(btn.dataset.id);
                if (eleve) { eleve.groupe = null; sauvegarder(); renderGroupes(); }
            });
        });

        panel.querySelectorAll('.etiquetteEleve').forEach(function (li) {
            li.addEventListener('dragstart', function (e) {
                dragEleveId = li.dataset.id;
                li.classList.add('dragging');
                e.dataTransfer.setData('text/plain', li.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
            });
            li.addEventListener('dragend', function () { li.classList.remove('dragging'); dragEleveId = null; });
        });

        panel.querySelectorAll('.zoneGroupe').forEach(function (zone) {
            zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragOver'); });
            zone.addEventListener('dragleave', function () { zone.classList.remove('dragOver'); });
            zone.addEventListener('drop', function (e) {
                e.preventDefault();
                zone.classList.remove('dragOver');
                var id = dragEleveId || e.dataTransfer.getData('text/plain');
                var eleve = trouverEleve(id);
                if (!eleve) return;
                var g = parseInt(zone.dataset.groupe, 10);
                eleve.groupe = g === 0 ? null : g;
                sauvegarder();
                renderGroupes();
            });
        });
    }

    function genererGroupesEquilibres() {
        var nb = state.nbGroupes;
        // Mélange aléatoire puis répartition tournante : donne des groupes de taille égale (à un près).
        var melange = state.eleves.slice().sort(function () { return Math.random() - 0.5; });
        melange.forEach(function (el, i) {
            el.groupe = (i % nb) + 1;
        });
        sauvegarder();
        renderGroupes();
    }

    // ---------- Vue Cantine / Garderie ----------

    function renderCantine() {
        var panel = $('panel-cantine');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Ajoutez des élèves pour renseigner cantine et garderie.');
            return;
        }

        function grilleJours(el, champ) {
            var jours = el[champ] || nouveauGarderieJours();
            var enTete = '<tr><th></th>' + JOURS_SEMAINE.map(function (j) { return '<th>' + j.label + '</th>'; }).join('') + '</tr>';
            function ligne(libelle, periode) {
                return '<tr><td>' + libelle + '</td>' + JOURS_SEMAINE.map(function (j) {
                    return '<td><input type="checkbox" data-id="' + el.id + '" data-champ="' + champ + '" data-jour="' + j.cle + '" data-periode="' + periode + '"' + (jours[j.cle][periode] ? ' checked' : '') + '></td>';
                }).join('') + '</tr>';
            }
            return '<table class="grilleGarderie">' + enTete + ligne('Matin', 'matin') + ligne('Après-midi', 'apresmidi') + '</table>';
        }

        var cartes = elevesTries().map(function (el) {
            return '<div class="carteCantine">' +
                '<div class="nomCarte">' + escapeHtml(nomComplet(el)) + '</div>' +
                '<div class="blocCantine">' +
                '<label class="checkLabel"><input type="checkbox" data-id="' + el.id + '" data-field="cantine"' + (el.cantine ? ' checked' : '') + '> Cantine</label>' +
                (el.cantine ? '<div class="sousOptions">' +
                    '<label class="checkLabel"><input type="checkbox" data-id="' + el.id + '" data-field="cantineSansViande"' + (el.cantineSansViande ? ' checked' : '') + '> Sans viande</label>' +
                    '<label class="checkLabel"><input type="checkbox" data-id="' + el.id + '" data-field="cantineSansPorc"' + (el.cantineSansPorc ? ' checked' : '') + '> Sans porc</label>' +
                    '</div>' : '') +
                '</div>' +
                '<div class="blocCantine">' +
                '<label class="checkLabel"><input type="checkbox" data-id="' + el.id + '" data-field="garderie"' + (el.garderie ? ' checked' : '') + '> Garderie</label>' +
                (el.garderie ? grilleJours(el, 'garderieJours') : '') +
                '</div>' +
                (el.aesh ? '<div class="blocCantine">' +
                    '<label class="checkLabel" style="margin-bottom:6px;">🧑‍🏫 Horaires de présence AESH</label>' +
                    grilleJours(el, 'aeshJours') +
                    '</div>' : '') +
                '<div class="blocCantine">' +
                '<label class="checkLabel" style="margin-bottom:6px;">⚠️ Allergie alimentaire</label>' +
                '<input type="text" class="editInput champInfoCantine" data-id="' + el.id + '" data-field="allergie" value="' + escapeHtml(el.allergie || '') + '" placeholder="Aucune">' +
                '</div>' +
                '<div class="blocCantine">' +
                '<label class="checkLabel" style="margin-bottom:6px;">📌 Remarque</label>' +
                '<input type="text" class="editInput champInfoCantine" data-id="' + el.id + '" data-field="remarque" value="' + escapeHtml(el.remarque || '') + '" placeholder="Note libre…">' +
                '</div>' +
                '</div>';
        }).join('');

        var impression = tableImpression(['Élève', 'Cantine', 'Garderie', 'Présence AESH', 'Allergie / PAI', 'Remarque'], elevesTries().map(function (el) {
            var regime = [el.cantineSansViande ? 'sans viande' : '', el.cantineSansPorc ? 'sans porc' : ''].filter(Boolean).join(', ');
            var sante = [el.allergie ? 'Allergie : ' + el.allergie : '', el.pai ? 'PAI' + (el.paiDetail ? ' : ' + el.paiDetail : '') : ''].filter(Boolean).join(' — ');
            return [escapeHtml(nomComplet(el)), el.cantine ? 'Oui' + (regime ? ' (' + regime + ')' : '') : '—',
                el.garderie ? escapeHtml(resumeJours(el.garderieJours, 'soir')) || 'Oui' : '—',
                el.aesh ? escapeHtml(resumeJours(el.aeshJours, 'après-midi')) || 'Oui' : '',
                escapeHtml(sante), escapeHtml(el.remarque || '')];
        }));
        panel.innerHTML = '<h2 style="margin-top:0;">Cantine et garderie</h2><div class="grilleCantine no-print">' + cartes + '</div>' + impression;

        panel.querySelectorAll('.champInfoCantine').forEach(function (input) {
            input.addEventListener('change', function () {
                var eleve = trouverEleve(input.dataset.id);
                if (eleve) { eleve[input.dataset.field] = input.value; sauvegarder(); }
            });
        });

        panel.querySelectorAll('input[type="checkbox"][data-field]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var eleve = trouverEleve(cb.dataset.id);
                if (!eleve) return;
                eleve[cb.dataset.field] = cb.checked;
                sauvegarder();
                if (cb.dataset.field === 'cantine' || cb.dataset.field === 'garderie') renderCantine();
            });
        });

        panel.querySelectorAll('input[type="checkbox"][data-jour]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var eleve = trouverEleve(cb.dataset.id);
                if (!eleve) return;
                var champ = cb.dataset.champ;
                if (!eleve[champ]) eleve[champ] = nouveauGarderieJours();
                eleve[champ][cb.dataset.jour][cb.dataset.periode] = cb.checked;
                sauvegarder();
            });
        });
    }

    // ---------- Vue Autres (pense-bête) ----------

    function renderAutres() {
        var panel = $('panel-autres');
        var lignes = state.notes.map(function (note, i) {
            return '<div class="ligneNote">' +
                '<button type="button" class="btnEmojiNote no-print" data-index="' + i + '" title="Choisir un emoji" aria-label="Choisir un emoji" aria-haspopup="true">' + (note.emoji || '➕') + '</button>' +
                '<input type="text" class="editInput" aria-label="Information ' + (i + 1) + '" data-index="' + i + '" data-champ="texte" value="' + escapeHtml(note.texte || '') + '" placeholder="Ex : Code photocopieuse : 1234">' +
                '<button type="button" class="btnSupprimer" data-index="' + i + '" title="Supprimer cette ligne" aria-label="Supprimer cette ligne">✕</button>' +
                '</div>';
        }).join('') || '<div class="notesVide">Aucune ligne pour l\'instant. Ajoutez-en une ci-dessous.</div>';

        panel.innerHTML =
            '<h2 style="margin-top:0;">📝 Informations importantes de la classe</h2>' +
            '<p class="autresIntro no-print">Notez ici vos codes ou informations diverses de la classe (une ligne par information, avec un emoji au choix pour vous repérer), à consulter ou imprimer à tout moment.</p>' +
            '<div class="boiteNotes no-print">' + lignes + '</div>' +
            '<ul class="notesImpression print-only">' + state.notes.filter(function (n) { return (n.texte || '').trim(); }).map(function (n) {
                return '<li>' + (n.emoji ? n.emoji + ' ' : '') + escapeHtml(n.texte) + '</li>';
            }).join('') + '</ul>' +
            '<button type="button" id="btnAjouterNote" class="softButton btnAjouterNote no-print">+ Ajouter une ligne</button>';

        panel.querySelectorAll('.editInput[data-index]').forEach(function (input) {
            input.addEventListener('change', function () {
                state.notes[parseInt(input.dataset.index, 10)][input.dataset.champ] = input.value;
                sauvegarder();
            });
        });

        panel.querySelectorAll('.btnSupprimer[data-index]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.notes.splice(parseInt(btn.dataset.index, 10), 1);
                sauvegarder();
                renderAutres();
            });
        });

        panel.querySelectorAll('.btnEmojiNote').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var dejaOuvert = btn.parentElement.querySelector('.popoverEmojis');
                document.querySelectorAll('.popoverEmojis').forEach(function (p) { p.remove(); });
                if (dejaOuvert) return;
                var i = parseInt(btn.dataset.index, 10);
                var popover = document.createElement('div');
                popover.className = 'popoverEmojis';
                popover.innerHTML = EMOJIS_ECOLE.map(function (em) {
                    return '<button type="button" data-emoji="' + em + '">' + em + '</button>';
                }).join('');
                popover.querySelectorAll('button').forEach(function (b) {
                    b.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        state.notes[i].emoji = b.dataset.emoji;
                        sauvegarder();
                        renderAutres();
                    });
                });
                btn.parentElement.style.position = 'relative';
                btn.parentElement.appendChild(popover);
            });
        });

        $('btnAjouterNote').addEventListener('click', function () {
            state.notes.push({ emoji: '', texte: '' });
            sauvegarder();
            renderAutres();
            var inputs = panel.querySelectorAll('.ligneNote:last-child input[data-champ="texte"]');
            if (inputs.length) inputs[0].focus();
        });
    }

    // ---------- Vue Suivi APC ----------

    function renderApc() {
        var panel = $('panel-apc');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Ajoutez des élèves pour suivre les séances d\'APC.');
            return;
        }

        var checklist = elevesTries().map(function (el) {
            return '<label class="checkLabel"><input type="checkbox" class="chkEleveApc" value="' + el.id + '"> ' + escapeHtml(nomComplet(el)) + '</label>';
        }).join('');

        var seances = state.apcSeances.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
        var listeHtml = seances.map(function (s) {
            var noms = s.eleveIds.map(function (id) {
                var el = trouverEleve(id);
                return el ? nomComplet(el) : null;
            }).filter(Boolean);
            return '<div class="carteApc">' +
                '<div class="enteteApc"><span class="dateApc">' + formatDateFR(s.date) + '</span>' +
                '<button type="button" class="btnSupprimer no-print" data-id="' + s.id + '" title="Supprimer cette séance" aria-label="Supprimer cette séance">✕</button></div>' +
                (s.domaine ? '<div class="domaineApc">' + escapeHtml(s.domaine) + '</div>' : '') +
                '<div class="tagsElevesApc">' + noms.map(function (n) { return '<span>' + escapeHtml(n) + '</span>'; }).join('') + '</div>' +
                (s.notes ? '<div class="notesApc">' + escapeHtml(s.notes) + '</div>' : '') +
                '</div>';
        }).join('') || '<div class="notesVide">Aucune séance enregistrée pour l\'instant.</div>';

        panel.innerHTML =
            '<h2 style="margin-top:0;">Suivi des séances d\'APC</h2>' +
            '<form id="formApc" class="formApc no-print">' +
            '<div class="formRow">' +
            '<div class="field"><label for="apcDate">Date</label><input type="date" id="apcDate" required></div>' +
            '<div class="field grow"><label for="apcDomaine">Domaine / objectif</label><input type="text" id="apcDomaine" placeholder="Ex : Lecture - fluence"></div>' +
            '</div>' +
            '<div class="formRow">' +
            '<div class="field grow"><label>Élèves présents</label><div class="checklistEleves">' + checklist + '</div></div>' +
            '</div>' +
            '<div class="formRow">' +
            '<div class="field grow"><label for="apcNotes">Notes</label><input type="text" id="apcNotes" placeholder="Observations, points travaillés…"></div>' +
            '</div>' +
            '<button type="submit" class="primaryButton">Enregistrer la séance <span class="arrow" aria-hidden="true">+</span></button>' +
            '</form>' +
            '<div class="listeSeancesApc">' + listeHtml + '</div>';

        $('apcDate').value = aujourdHuiISO();

        $('formApc').addEventListener('submit', function (e) {
            e.preventDefault();
            var date = $('apcDate').value;
            if (!date) return;
            var idsCoches = [...panel.querySelectorAll('.chkEleveApc:checked')].map(function (cb) { return cb.value; });
            state.apcSeances.push({
                id: uid(),
                date: date,
                domaine: $('apcDomaine').value.trim(),
                eleveIds: idsCoches,
                notes: $('apcNotes').value.trim()
            });
            sauvegarder();
            renderApc();
        });

        panel.querySelectorAll('.listeSeancesApc .btnSupprimer').forEach(function (btn) {
            btn.addEventListener('click', function () {
                showConfirm('Supprimer la séance', 'Voulez-vous vraiment supprimer cette séance d\'APC ?', function () {
                    state.apcSeances = state.apcSeances.filter(function (s) { return s.id !== btn.dataset.id; });
                    sauvegarder();
                    renderApc();
                });
            });
        });
    }

    // ---------- Vue Pointage / exportation PDF ----------
    // Feuille de pointage pour une date précise : la sélection des élèves est pré-remplie depuis
    // les onglets Cantine / Garderie / Suivi APC, ajustable à la main, puis imprimée (ou enregistrée
    // en PDF depuis la fenêtre d'impression du navigateur).

    // L'ordre des clés est celui des sous-onglets. Listes « grille » : N°, élève et colonnes vides à remplir à la main.
    var TYPES_POINTAGE = {
        generale: { label: '📋 Liste générale', titre: 'Liste de la classe', grille: true, colonnesVides: 5 },
        rapide: { label: '⚡ Liste rapide', titre: 'Liste de la classe', grille: true, colonnesVides: 2 },
        cantine: { label: '🍽️ Cantine', titre: 'Pointage cantine' },
        garderie: { label: '🌅 Garderie', titre: 'Pointage garderie' },
        apc: { label: '🎯 APC', titre: 'Pointage APC' },
        sortie: { label: '🚌 Sortie / appel', titre: 'Liste d\'appel' },
        perso: { label: '✨ Liste personnalisée', titre: 'Liste de la classe', grille: true, colonnesVides: 2 }
    };

    // Colonnes proposées dans la liste personnalisée (N° et Présent se placent avant le nom, les autres après).
    var COLONNES_PERSO = [
        { cle: 'num', titre: 'N°', classe: 'colNum', avantNom: true, cellule: function (el, numero) { return numero; } },
        { cle: 'presence', titre: 'Présent', classe: 'colCase', avantNom: true, cellule: function () { return '<span class="caseCoche"></span>'; } },
        { cle: 'niveau', titre: 'Niveau', classe: 'colInfo', cellule: function (el) { return escapeHtml(el.niveau || ''); } },
        { cle: 'naissance', titre: 'Naissance', classe: 'colInfo', cellule: function (el) { return formatDateFR(el.dateNaissance); } },
        { cle: 'genre', titre: 'Genre', classe: 'colInfo', cellule: function (el) { return el.genre === 'M' ? 'G' : 'F'; } },
        { cle: 'cantine', titre: 'Cantine', classe: 'colInfo', cellule: function (el) {
            if (!el.cantine) return '—';
            var r = [el.cantineSansViande ? 'sans viande' : '', el.cantineSansPorc ? 'sans porc' : ''].filter(Boolean).join(', ');
            return 'Oui' + (r ? ' (' + r + ')' : '');
        } },
        { cle: 'garderie', titre: 'Garderie du jour', classe: 'colInfo', cellule: function (el) {
            var jour = cleJourSemaine(pointageDate);
            return [inscritGarderie(el, jour, 'matin') ? 'matin' : '', inscritGarderie(el, jour, 'apresmidi') ? 'soir' : ''].filter(Boolean).join(' + ') || '—';
        } },
        { cle: 'sante', titre: 'Allergie / PAI', classe: 'colInfo', cellule: function (el) {
            return escapeHtml([el.allergie ? 'Allergie : ' + el.allergie : '', el.pai ? 'PAI' + (el.paiDetail ? ' : ' + el.paiDetail : '') : ''].filter(Boolean).join(' — '));
        } },
        { cle: 'aesh', titre: 'AESH', classe: 'colInfo', cellule: function (el) { return el.aesh ? 'Oui' : ''; } },
        { cle: 'remarque', titre: 'Remarque', classe: 'colInfo', cellule: function (el) { return escapeHtml(el.remarque || ''); } }
    ];

    // Lecture sans risque des options perso (les valeurs par défaut ne sont jamais modifiées en place).
    function optionsPerso() {
        return Object.assign({}, POINTAGE_DEFAUT.perso, state.pointage.perso);
    }
    var pointageSelection = null; // ids des élèves inclus dans la feuille ; null = pas encore calculé
    var pointageDate = '';        // date de la feuille (aujourd'hui par défaut, non conservée entre deux sessions)

    function formatDateLongue(iso) {
        var d = dateVersObjet(iso);
        if (!d) return '';
        var t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    function cleJourSemaine(iso) {
        var d = dateVersObjet(iso);
        var jour = d ? JOURS_SEMAINE[d.getDay() - 1] : null;
        return jour ? jour.cle : null;
    }

    function nomPointage(el) {
        var a = state.pointage.affichage;
        if (a === 'prenom') return el.prenom;
        if (a === 'prenomNom') return el.prenom + (el.nom ? ' ' + el.nom.toUpperCase() : '');
        return nomComplet(el);
    }

    function niveauOrdre(el) { return NIVEAUX_ORDRE[el.niveau] || 99; }

    // Tri des élèves selon les options du pointage : niveau d'abord (si séparé), puis ordre alphabétique choisi.
    function elevesPourPointage() {
        var p = state.pointage;
        function cmp(x, y) { return (x || '').localeCompare(y || '', 'fr', { sensitivity: 'base' }); }
        return state.eleves.slice().sort(function (a, b) {
            if (p.parNiveau) {
                var n = niveauOrdre(a) - niveauOrdre(b) || cmp(a.niveau, b.niveau);
                if (n) return n;
            }
            if (p.tri === 'prenom') return cmp(a.prenom, b.prenom) || cmp(a.nom, b.nom);
            return cmp(a.nom || a.prenom, b.nom || b.prenom) || cmp(a.prenom, b.prenom);
        });
    }

    // Nombre de colonnes vides de la feuille : la liste personnalisée garde le sien (il n'est pas remis à zéro en changeant de sous-onglet).
    function nbColonnesVides(type) {
        return bornerColonnesVides(type === 'perso' ? optionsPerso().colonnesVides : state.pointage.colonnesVides, type);
    }

    // La liste personnalisée accepte 0 colonne vide (si elle ne contient que des colonnes d'informations).
    function bornerColonnesVides(v, type) {
        var min = type === 'perso' ? 0 : 1;
        if (v === null || v === undefined || v === '') return TYPES_POINTAGE[type].colonnesVides || 0;
        var n = parseInt(v, 10);
        return Math.max(min, Math.min(MAX_COLONNES_VIDES, isNaN(n) ? min : n));
    }

    // periode : 'matin' ou 'apresmidi' (garderie du soir).
    function inscritGarderie(el, jour, periode) {
        return !!(jour && el.garderie && el.garderieJours && el.garderieJours[jour] && el.garderieJours[jour][periode]);
    }

    // Élèves à inclure d'office selon le type de liste et la date.
    function preremplissagePointage(type, dateIso) {
        var ids = [], note = '', domaine = '';
        var jour = cleJourSemaine(dateIso);
        if (type === 'cantine') {
            ids = state.eleves.filter(function (el) { return el.cantine; }).map(function (el) { return el.id; });
            if (!ids.length) note = 'Aucun élève n\'est inscrit à la cantine (onglet Cantine / Garderie) : cochez les élèves concernés.';
        } else if (type === 'garderie') {
            if (!jour) {
                note = 'Cette date tombe un week-end : aucune garderie prévue.';
            } else {
                ids = state.eleves.filter(function (el) {
                    return inscritGarderie(el, jour, 'matin') || inscritGarderie(el, jour, 'apresmidi');
                }).map(function (el) { return el.id; });
                if (!ids.length) note = 'Aucun élève inscrit à la garderie ce jour-là (onglet Cantine / Garderie) : cochez les élèves concernés.';
            }
        } else if (type === 'apc') {
            var seances = state.apcSeances.filter(function (s) { return s.date === dateIso; });
            var vus = {};
            seances.forEach(function (s) { (s.eleveIds || []).forEach(function (id) { vus[id] = true; }); });
            ids = state.eleves.filter(function (el) { return vus[el.id]; }).map(function (el) { return el.id; });
            domaine = seances.map(function (s) { return s.domaine; }).filter(Boolean).join(' / ');
            if (!seances.length) note = 'Aucune séance d\'APC enregistrée à cette date (onglet Suivi APC) : cochez les élèves concernés.';
        } else {
            ids = state.eleves.map(function (el) { return el.id; });
        }
        return { ids: ids, note: note, domaine: domaine };
    }

    function colonnesPointage(type) {
        var caseCoche = { titre: 'Présent', classe: 'colCase', cellule: function () { return '<span class="caseCoche"></span>'; } };
        var eleve = { titre: state.pointage.affichage === 'prenom' ? 'Prénom' : 'Élève', classe: 'colNom', cellule: function (el) { return escapeHtml(nomPointage(el)); } };
        var vide = function (titre, classe) { return { titre: titre, classe: classe, cellule: function () { return ''; } }; };
        var remarque = { titre: 'Remarque', classe: 'colLarge', cellule: function (el) { return escapeHtml(el.remarque || ''); } };

        if (type === 'perso') {
            var choix = optionsPerso().colonnes;
            var retenues = COLONNES_PERSO.filter(function (c) { return choix.indexOf(c.cle) !== -1; });
            var cols = retenues.filter(function (c) { return c.avantNom; }).concat([eleve], retenues.filter(function (c) { return !c.avantNom; }));
            for (var v = 0; v < nbColonnesVides(type); v++) cols.push(vide('', 'colVide'));
            return cols;
        }

        if (TYPES_POINTAGE[type].grille) {
            var colonnes = [{ titre: 'N°', classe: 'colNum', cellule: function (el, numero) { return numero; } }, eleve];
            for (var k = 0; k < nbColonnesVides(type); k++) colonnes.push(vide('', 'colVide'));
            return colonnes;
        }

        if (type === 'cantine') {
            return [caseCoche, eleve,
                { titre: 'Régime', classe: 'colMoyenne', cellule: function (el) {
                    var r = [];
                    if (el.cantineSansViande) r.push('Sans viande');
                    if (el.cantineSansPorc) r.push('Sans porc');
                    return escapeHtml(r.join(', '));
                } },
                { titre: 'Allergie / PAI', classe: 'colMoyenne', cellule: function (el) {
                    var r = [];
                    if (el.allergie) r.push('Allergie : ' + el.allergie);
                    if (el.pai) r.push('PAI' + (el.paiDetail ? ' : ' + el.paiDetail : ''));
                    return escapeHtml(r.join(' — '));
                } },
                remarque];
        }
        if (type === 'garderie') {
            // Case à cocher si l'élève est inscrit à ce créneau ce jour-là, « — » sinon.
            var creneau = function (titre, periode) {
                return { titre: titre, classe: 'colCase', cellule: function (el) {
                    return inscritGarderie(el, cleJourSemaine(pointageDate), periode) ? '<span class="caseCoche"></span>' : '—';
                } };
            };
            return [eleve, creneau('Matin', 'matin'), vide('Arrivée', 'colHeure'), creneau('Soir', 'apresmidi'), vide('Départ', 'colHeure'), remarque];
        }
        if (type === 'apc') {
            return [caseCoche, eleve,
                { titre: 'Niveau', classe: 'colHeure', cellule: function (el) { return escapeHtml(el.niveau || ''); } },
                vide('Remarque', 'colLarge')];
        }
        return [caseCoche, eleve,
            { titre: 'Autorisation reçue', classe: 'colHeure', cellule: function () { return '<span class="caseCoche"></span>'; } },
            remarque];
    }

    function rafraichirFeuillePointage() {
        var p = state.pointage;
        var type = TYPES_POINTAGE[p.type] ? p.type : 'generale';
        var perso = optionsPerso();
        var enteteVierge = TYPES_POINTAGE[type].grille && (type !== 'perso' || perso.enteteVierge);
        var deuxExemplaires = type === 'rapide' || (type === 'perso' && perso.deuxExemplaires);
        var def = TYPES_POINTAGE[type];
        var choisis = elevesPourPointage().filter(function (el) { return pointageSelection.indexOf(el.id) !== -1; });
        var colonnes = colonnesPointage(type);

        var details = [];
        if (type === 'cantine') {
            var sansViande = choisis.filter(function (el) { return el.cantineSansViande; }).length;
            var sansPorc = choisis.filter(function (el) { return el.cantineSansPorc; }).length;
            if (sansViande) details.push(sansViande + ' sans viande');
            if (sansPorc) details.push(sansPorc + ' sans porc');
        }
        if (type === 'garderie') {
            var jour = cleJourSemaine(pointageDate);
            ['matin', 'apresmidi'].forEach(function (periode) {
                var n = choisis.filter(function (el) { return inscritGarderie(el, jour, periode); }).length;
                details.push(n + (periode === 'matin' ? ' le matin' : ' le soir'));
            });
        }
        var domaine = preremplissagePointage(type, pointageDate).domaine;
        if (domaine) details.push('Domaine : ' + domaine);
        var sousTitre = choisis.length + (def.grille ? (choisis.length > 1 ? ' élèves' : ' élève') : (choisis.length > 1 ? ' élèves attendus' : ' élève attendu')) + (details.length ? ' — ' + details.join(' — ') : '');

        var effectifs = {};
        choisis.forEach(function (el) { effectifs[el.niveau] = (effectifs[el.niveau] || 0) + 1; });
        var lignes = [];
        choisis.forEach(function (el, i) {
            if (p.parNiveau && (i === 0 || choisis[i - 1].niveau !== el.niveau)) {
                lignes.push('<tr class="ligneNiveau"><td colspan="' + colonnes.length + '">' + escapeHtml(el.niveau) + ' (' + effectifs[el.niveau] + ')</td></tr>');
            }
            lignes.push('<tr>' + colonnes.map(function (c) { return '<td class="' + c.classe + '">' + c.cellule(el, i + 1) + '</td>'; }).join('') + '</tr>');
        });
        var nbVides = bornerLignesVides(p.lignesVides);
        for (var i = 0; i < nbVides; i++) {
            lignes.push('<tr>' + colonnes.map(function (c) {
                return '<td class="' + c.classe + '">' + (c.classe === 'colCase' ? '<span class="caseCoche"></span>' : '') + '</td>';
            }).join('') + '</tr>');
        }

        // Les listes grille ont une ligne d'en-tête vierge au-dessus, pour écrire à la main le titre des colonnes.
        var table = '<table class="tablePointage' + (def.grille ? ' tableGrille' : '') + '"><thead>' +
            (enteteVierge ? '<tr class="ligneTitres">' + colonnes.map(function (c) { return '<th class="' + c.classe + '"></th>'; }).join('') + '</tr>' : '') +
            '<tr>' + colonnes.map(function (c) { return '<th class="' + c.classe + '">' + c.titre + '</th>'; }).join('') + '</tr></thead>' +
            '<tbody>' + lignes.join('') + '</tbody></table>';

        // Orientation d'impression (listes rapide / générale) : appliquée via des pages nommées en CSS (@page portrait / paysage).
        // En paysage, au-delà de 27 lignes (élèves, bandeaux de niveau, lignes vides), on resserre pour tenir sur une page.
        var paysage = p.orientation === 'paysage';
        $('feuillePointage').className = 'feuillePointage' + (def.grille ? (paysage ? ' paysage' : ' portrait') + (paysage && lignes.length > 27 ? ' compacte' : '') : '');
        $('feuillePointage').innerHTML =
            '<div class="enteteFeuille"><h2>' + escapeHtml(p.titre.trim() || def.titre) + '</h2>' +
            '<div class="dateFeuille">' + escapeHtml(formatDateLongue(pointageDate)) + '</div></div>' +
            '<div class="sousTitreFeuille">' + escapeHtml(sousTitre) + '</div>' +
            (deuxExemplaires ? '<div class="duoPointage">' + table + table + '</div>' : table) +
            (def.grille ? '' : '<div class="piedFeuille"><span>Présents : ……… / ' + choisis.length + '</span><span>Pointage effectué par : ……………………………</span></div>');
    }

    function majResumeSelectionPointage() {
        $('resumeSelectionPointage').textContent = 'Élèves inclus dans la feuille (' + pointageSelection.length + ' / ' + state.eleves.length + ')';
    }

    function rafraichirSelectionPointage() {
        $('checklistPointage').innerHTML = elevesPourPointage().map(function (el) {
            return '<label class="checkLabel"><input type="checkbox" value="' + el.id + '"' + (pointageSelection.indexOf(el.id) !== -1 ? ' checked' : '') + '> ' + escapeHtml(nomPointage(el)) + '</label>';
        }).join('');
        majResumeSelectionPointage();
    }

    function afficherNotePointage() {
        var note = preremplissagePointage(state.pointage.type, pointageDate).note;
        $('notePointage').textContent = note;
        $('notePointage').hidden = !note;
    }

    function rafraichirPointage() {
        afficherNotePointage();
        rafraichirSelectionPointage();
        rafraichirFeuillePointage();
    }

    // Remet la sélection sur le pré-remplissage du type et de la date courants.
    function reinitialiserSelectionPointage() {
        pointageSelection = preremplissagePointage(state.pointage.type, pointageDate).ids;
        rafraichirPointage();
    }

    function renderPointage() {
        var panel = $('panel-pointage');
        if (state.eleves.length === 0) {
            panel.innerHTML = elevesVides('Ajoutez des élèves pour préparer une feuille de pointage.');
            return;
        }
        var p = state.pointage;
        if (p.type === 'garderieMatin' || p.type === 'garderieSoir') p.type = 'garderie'; // anciens types, fusionnés
        if (!TYPES_POINTAGE[p.type]) p.type = 'generale';
        if (!pointageDate) pointageDate = aujourdHuiISO();

        function options(valeurs, actuelle) {
            return Object.keys(valeurs).map(function (cle) {
                return '<option value="' + cle + '"' + (cle === actuelle ? ' selected' : '') + '>' + valeurs[cle] + '</option>';
            }).join('');
        }
        var sousOnglets = Object.keys(TYPES_POINTAGE).map(function (cle) {
            var actif = cle === p.type;
            return '<button type="button" class="sousOnglet' + (cle === 'perso' ? ' sousOngletPerso' : '') + (actif ? ' active' : '') + '" role="tab" aria-selected="' + actif + '" data-type="' + cle + '">' + TYPES_POINTAGE[cle].label + '</button>';
        }).join('');
        var perso = optionsPerso();
        var blocPerso = p.type !== 'perso' ? '' :
            '<fieldset class="optionsPerso"><legend>Colonnes à inclure (en plus du nom de l\'élève)</legend>' +
            '<div class="checklistEleves" id="persoColonnes">' + COLONNES_PERSO.map(function (c) {
                return '<label class="checkLabel"><input type="checkbox" value="' + c.cle + '"' + (perso.colonnes.indexOf(c.cle) !== -1 ? ' checked' : '') + '> ' + c.titre + '</label>';
            }).join('') + '</div>' +
            '<div class="formRow">' +
            '<div class="field checks"><label class="checkLabel"><input type="checkbox" id="persoDeux"' + (perso.deuxExemplaires ? ' checked' : '') + '> 2 exemplaires côte à côte</label></div>' +
            '<div class="field checks"><label class="checkLabel"><input type="checkbox" id="persoEntete"' + (perso.enteteVierge ? ' checked' : '') + '> Ligne vierge au-dessus des en-têtes</label></div>' +
            '</div></fieldset>';

        panel.innerHTML =
            '<div class="sousOnglets no-print" role="tablist" aria-label="Type de liste">' + sousOnglets + '</div>' +
            '<div class="pointageOutils no-print">' +
            blocPerso +
            '<div class="formRow">' +
            '<div class="field"><label for="pointageDate">Date</label><input type="date" id="pointageDate" value="' + pointageDate + '"></div>' +
            '<div class="field grow"><label for="pointageTitre">Titre (facultatif)</label><input type="text" id="pointageTitre" value="' + escapeHtml(p.titre) + '" placeholder="Ex : Sortie au musée"></div>' +
            '<div class="field"><label for="pointageVides">Lignes vides en plus</label><input type="number" id="pointageVides" min="0" max="' + MAX_LIGNES_VIDES + '" value="' + bornerLignesVides(p.lignesVides) + '"></div>' +
            '</div>' +
            '<div class="formRow">' +
            '<div class="field"><label for="pointageAffichage">Affichage des noms</label><select id="pointageAffichage" class="selectNiveau">' +
            options({ nomPrenom: 'NOM Prénom', prenomNom: 'Prénom NOM', prenom: 'Prénom seul' }, p.affichage) + '</select></div>' +
            '<div class="field"><label for="pointageTri">Ordre alphabétique</label><select id="pointageTri" class="selectNiveau">' +
            options({ nom: 'Par nom de famille', prenom: 'Par prénom' }, p.tri) + '</select></div>' +
            '<div class="field checks"><label class="checkLabel"><input type="checkbox" id="pointageParNiveau"' + (p.parNiveau ? ' checked' : '') + '> Séparer par niveau</label></div>' +
            (TYPES_POINTAGE[p.type].grille ? '<div class="field"><label for="pointageColonnes">Colonnes à remplir</label><input type="number" id="pointageColonnes" min="' + (p.type === 'perso' ? 0 : 1) + '" max="' + MAX_COLONNES_VIDES + '" value="' + nbColonnesVides(p.type) + '"></div>' +
                '<div class="field"><label for="pointageOrientation">Orientation</label><select id="pointageOrientation" class="selectNiveau">' +
                options({ portrait: 'Portrait', paysage: 'Paysage' }, p.orientation) + '</select></div>' : '') +
            '</div>' +
            '<div class="notePointage" id="notePointage" hidden></div>' +
            '<details class="selectionPointage" open>' +
            '<summary id="resumeSelectionPointage"></summary>' +
            '<div class="actionsSelection">' +
            '<button type="button" class="softButton" id="btnPointagePre">↺ Pré-remplissage</button>' +
            '<button type="button" class="softButton" id="btnPointageTous">Toute la classe</button>' +
            '<button type="button" class="softButton" id="btnPointageAucun">Aucun</button>' +
            '</div>' +
            '<div class="checklistEleves" id="checklistPointage"></div>' +
            '</details>' +
            '<button type="button" id="btnImprimerPointage" class="primaryButton">🖨️ Imprimer / enregistrer en PDF</button>' +
            '</div>' +
            '<div class="feuillePointage" id="feuillePointage"></div>';

        panel.querySelector('.sousOnglets').addEventListener('click', function (e) {
            var btn = e.target.closest('.sousOnglet');
            if (!btn || btn.dataset.type === state.pointage.type) return;
            state.pointage.type = btn.dataset.type;
            state.pointage.titre = '';
            state.pointage.colonnesVides = null;
            // Calculée avant de redessiner : le panneau remplacé peut encore émettre un « change » tardif.
            pointageSelection = preremplissagePointage(state.pointage.type, pointageDate).ids;
            sauvegarder();
            renderPointage();
        });
        function optionAffichage(id, champ, valeur) {
            $(id).addEventListener('change', function () {
                state.pointage[champ] = valeur(this);
                sauvegarder();
                rafraichirSelectionPointage();
                rafraichirFeuillePointage();
            });
        }
        optionAffichage('pointageAffichage', 'affichage', function (e) { return e.value; });
        optionAffichage('pointageTri', 'tri', function (e) { return e.value; });
        optionAffichage('pointageParNiveau', 'parNiveau', function (e) { return e.checked; });
        if ($('pointageColonnes')) {
            $('pointageColonnes').addEventListener('change', function () {
                var type = state.pointage.type, n = bornerColonnesVides(this.value, type);
                if (type === 'perso') state.pointage.perso = Object.assign(optionsPerso(), { colonnesVides: n });
                else state.pointage.colonnesVides = n;
                sauvegarder();
                rafraichirFeuillePointage();
            });
            optionAffichage('pointageOrientation', 'orientation', function (e) { return e.value; });
        }
        if (p.type === 'perso') {
            function majPerso(changement) {
                state.pointage.perso = Object.assign(optionsPerso(), changement);
                sauvegarder();
                rafraichirFeuillePointage();
            }
            $('persoColonnes').addEventListener('change', function () {
                majPerso({ colonnes: [...panel.querySelectorAll('#persoColonnes input:checked')].map(function (cb) { return cb.value; }) });
            });
            $('persoDeux').addEventListener('change', function () { majPerso({ deuxExemplaires: this.checked }); });
            $('persoEntete').addEventListener('change', function () { majPerso({ enteteVierge: this.checked }); });
        }
        $('pointageDate').addEventListener('change', function () {
            pointageDate = this.value || aujourdHuiISO();
            reinitialiserSelectionPointage();
        });
        $('pointageTitre').addEventListener('input', function () {
            state.pointage.titre = this.value;
            sauvegarder();
            rafraichirFeuillePointage();
        });
        $('pointageVides').addEventListener('input', function () {
            state.pointage.lignesVides = bornerLignesVides(this.value);
            sauvegarder();
            rafraichirFeuillePointage();
        });
        $('checklistPointage').addEventListener('change', function (e) {
            var id = e.target.value;
            var i = pointageSelection.indexOf(id);
            if (e.target.checked && i === -1) pointageSelection.push(id);
            if (!e.target.checked && i !== -1) pointageSelection.splice(i, 1);
            majResumeSelectionPointage();
            rafraichirFeuillePointage();
        });
        $('btnPointagePre').addEventListener('click', reinitialiserSelectionPointage);
        $('btnPointageTous').addEventListener('click', function () {
            pointageSelection = state.eleves.map(function (el) { return el.id; });
            rafraichirPointage();
        });
        $('btnPointageAucun').addEventListener('click', function () {
            pointageSelection = [];
            rafraichirPointage();
        });
        $('btnImprimerPointage').addEventListener('click', function () { lancerImpressionSections(['pointage']); });

        if (pointageSelection === null) {
            reinitialiserSelectionPointage();
        } else {
            // La sélection en cours survit à un changement d'onglet ; on écarte seulement les élèves supprimés.
            pointageSelection = pointageSelection.filter(trouverEleve);
            rafraichirPointage();
        }
    }

    // ---------- Vue Plan de classe ----------
    // La salle est un repère logique de PLAN_LARGEUR unités de large (hauteur variable) : tables et mobilier y sont
    // positionnés en unités puis affichés en pourcentages, si bien que le plan s'adapte à toute largeur d'écran.
    // Deux étapes : « Aménager la salle » (déplacer / redimensionner / pivoter / supprimer) et « Placer les élèves ».
    // Les élèves de la liste se glissent sur les places dans les deux étapes, à la souris comme au doigt.

    var PLAN_LARGEUR = 1000;
    var PLAN_HAUTEUR_MIN = 640;
    var PLAN_PAS = 10;                          // aimantation des déplacements et redimensionnements
    var LARGEUR_PLACE = 90, HAUTEUR_TABLE = 58;
    var MAX_PLACES_TABLE = 4;
    var PLACE_MIN = 50, EPAISSEUR_MIN = 40;     // taille minimale d'une place : un prénom doit rester lisible
    var MOBILIER = {
        bureau: { label: 'Bureau', icone: '🧑‍🏫', w: 140, h: 60 },
        porte: { label: 'Porte', icone: '🚪', w: 90, h: 20 },
        fenetre: { label: 'Fenêtre', icone: '🪟', w: 160, h: 16 },
        armoire: { label: 'Armoire', icone: '🗄️', w: 120, h: 50 },
        divers: { label: 'Autre', icone: '📦', w: 120, h: 70 }
    };
    var COULEURS_DEFAUT = { F: '#c9ecc6', M: '#ffd5a8' };   // pastels : vert pour les filles, orange pour les garçons
    var DISPOSITIONS = {
        rangees: { label: 'Rangées de tables doubles', desc: '3 colonnes de tables à 2 places' },
        ilots: { label: 'Îlots de 4', desc: '2 tables doubles face à face' },
        u: { label: 'En U', desc: 'Tables individuelles autour d\'un espace central' },
        simples: { label: 'Tables individuelles', desc: '5 colonnes de tables à 1 place' }
    };

    function nouveauPlan() {
        return {
            tables: [], hauteur: PLAN_HAUTEUR_MIN, mode: 'amenager', affichage: 'prenom', mixte: true, vueEleves: false,
            remplissage: 'devant', couleurs: { actif: true, F: COULEURS_DEFAUT.F, M: COULEURS_DEFAUT.M },
            epingles: {}, contraintes: [], noticeOuverte: true,
            export: { vide: false, reperes: false, vueEleves: false, titre: 'Plan de classe' }
        };
    }

    function tailleParDefaut(type, places) {
        return type === 'table' ? { w: LARGEUR_PLACE * places, h: HAUTEUR_TABLE } : { w: MOBILIER[type].w, h: MOBILIER[type].h };
    }

    function normaliserPlan(p) {
        var plan = nouveauPlan();
        if (p && typeof p === 'object') Object.keys(plan).forEach(function (cle) { if (p[cle] !== undefined && p[cle] !== null) plan[cle] = p[cle]; });
        plan.hauteur = Math.max(PLAN_HAUTEUR_MIN, Number(plan.hauteur) || 0);
        plan.couleurs = Object.assign(nouveauPlan().couleurs, plan.couleurs);
        plan.export = Object.assign(nouveauPlan().export, plan.export);
        if (typeof plan.epingles !== 'object' || Array.isArray(plan.epingles)) plan.epingles = {};
        if (!Array.isArray(plan.contraintes)) plan.contraintes = [];
        plan.tables = Array.isArray(plan.tables) ? plan.tables.filter(function (t) { return t && t.id; }) : [];
        plan.tables.forEach(function (t) {
            if (!t.type) t.type = t.bureau ? 'bureau' : 'table';   // plans enregistrés avant l'ajout du mobilier
            if (t.type !== 'table' && !MOBILIER[t.type]) t.type = 'divers';
            t.places = t.type === 'table' ? Math.max(1, Math.min(MAX_PLACES_TABLE, t.places || 1)) : 0;
            t.eleves = Array.from({ length: t.places }, function (_, i) { return (t.eleves && t.eleves[i]) || null; });
            if (!t.w || !t.h) {
                var d = tailleParDefaut(t.type, t.places);
                t.w = t.vertical ? d.h : d.w;
                t.h = t.vertical ? d.w : d.h;
            }
            delete t.vertical;
            delete t.bureau;
        });
        return plan;
    }

    function nouvelleTable(x, y, places, vertical) {
        var d = tailleParDefaut('table', places);
        return { id: uid(), type: 'table', x: x, y: y, w: vertical ? d.h : d.w, h: vertical ? d.w : d.h, places: places,
            eleves: Array.from({ length: places }, function () { return null; }) };
    }

    function nouveauMeuble(type, label) {
        var d = tailleParDefaut(type);
        return { id: uid(), type: type, label: label || '', x: PLAN_LARGEUR - d.w - 40, y: 14, w: d.w, h: d.h, places: 0, eleves: [] };
    }

    function nomMeuble(t) { return MOBILIER[t.type].icone + ' ' + (t.label || MOBILIER[t.type].label); }

    // Côté court minimal et côté long minimal (qui dépend du nombre de places).
    function limitesTaille(t) {
        return t.type === 'table' ? { court: EPAISSEUR_MIN, long: PLACE_MIN * t.places } : { court: 14, long: 20 };
    }

    function ajusterHauteurPlan() {
        var bas = state.plan.tables.reduce(function (m, t) { return Math.max(m, t.y + t.h); }, 0);
        state.plan.hauteur = Math.max(PLAN_HAUTEUR_MIN, Math.ceil((bas + 40) / PLAN_PAS) * PLAN_PAS);
    }

    // Tables d'une disposition type pour n places (centrées dans la salle, première rangée sous le tableau).
    function genererDisposition(cle, n) {
        var tables = [], y0 = 110;
        function grille(nbTables, cols, largeurTable, ecartX, pasY, fabrique) {
            var x0 = (PLAN_LARGEUR - (cols * largeurTable + (cols - 1) * ecartX)) / 2;
            for (var i = 0; i < nbTables; i++) fabrique(x0 + (i % cols) * (largeurTable + ecartX), y0 + Math.floor(i / cols) * pasY);
        }
        if (cle === 'rangees') {
            grille(Math.ceil(n / 2), 3, 2 * LARGEUR_PLACE, 110, HAUTEUR_TABLE + 44, function (x, y) { tables.push(nouvelleTable(x, y, 2)); });
        } else if (cle === 'ilots') {
            var nbIlots = Math.ceil(n / 4);
            grille(nbIlots, nbIlots <= 4 ? 2 : 3, 2 * LARGEUR_PLACE, 130, 2 * HAUTEUR_TABLE + 70, function (x, y) {
                tables.push(nouvelleTable(x, y, 2), nouvelleTable(x, y + HAUTEUR_TABLE, 2));
            });
        } else if (cle === 'simples') {
            grille(n, 5, LARGEUR_PLACE, 90, HAUTEUR_TABLE + 36, function (x, y) { tables.push(nouvelleTable(x, y, 1)); });
        } else {
            // En U : jusqu'à 20 tables individuelles sur le pourtour (ouverture vers le tableau),
            // les élèves en surplus sur des tables doubles au centre.
            var pas = LARGEUR_PLACE + 6, pasCote = HAUTEUR_TABLE + 8, pourtour = Math.min(n, 20);
            var cote = Math.floor(pourtour / 3), fond = pourtour - 2 * cote;
            var centre = n - pourtour, finCentre = y0 + 40;
            grille(Math.ceil(centre / 2), 2, 2 * LARGEUR_PLACE, 60, HAUTEUR_TABLE + 40, function (x, y) {
                tables.push(nouvelleTable(x, y + 60, 2));
                finCentre = y + 60 + HAUTEUR_TABLE;
            });
            for (var i = 0; i < cote; i++) {
                tables.push(nouvelleTable(40, y0 + 20 + i * pasCote, 1));
                tables.push(nouvelleTable(PLAN_LARGEUR - 40 - LARGEUR_PLACE, y0 + 20 + i * pasCote, 1));
            }
            var yFond = Math.max(y0 + 20 + cote * pasCote + 10, finCentre + 40);
            var xFond = (PLAN_LARGEUR - (fond * pas - 6)) / 2;
            for (var j = 0; j < fond; j++) tables.push(nouvelleTable(xFond + j * pas, yFond, 1));
        }
        return tables;
    }

    // Remplace les tables par une disposition type ; le mobilier déjà posé est conservé.
    function appliquerDisposition(cle) {
        memoriserPlan();
        var meubles = state.plan.tables.filter(function (t) { return t.type !== 'table'; });
        if (!meubles.some(function (t) { return t.type === 'bureau'; })) meubles.unshift(nouveauMeuble('bureau'));
        state.plan.tables = meubles.concat(genererDisposition(cle, state.eleves.length || 24));
        state.plan.vueEleves = false;
        tableActive = null;
        ajusterHauteurPlan();
        sauvegarder();
        rafraichirPlan();
    }

    function chevauche(a, b, marge) {
        return a.x < b.x + b.w + marge && b.x < a.x + a.w + marge && a.y < b.y + b.h + marge && b.y < a.y + a.h + marge;
    }

    // Ajoute une table ou un meuble au premier emplacement libre (sinon en bas de la salle, qui s'agrandit).
    function ajouterElement(item) {
        memoriserPlan();
        var trouve = false;
        for (var y = 110; y + item.h <= state.plan.hauteur - 20 && !trouve; y += 20) {
            for (var x = 30; x + item.w <= PLAN_LARGEUR - 30 && !trouve; x += 20) {
                item.x = x; item.y = y;
                trouve = !state.plan.tables.some(function (t) { return chevauche(item, t, 20); });
            }
        }
        if (!trouve) { item.x = 30; item.y = state.plan.hauteur - 20; }
        state.plan.tables.push(item);
        tableActive = item.id;
        ajusterHauteurPlan();
        sauvegarder();
        rafraichirPlan();
        focusTable(item.id);
    }

    function trouverTable(id) { return state.plan.tables.find(function (t) { return t.id === id; }); }

    function placeDe(eleveId) {
        for (var i = 0; i < state.plan.tables.length; i++) {
            var idx = state.plan.tables[i].eleves.indexOf(eleveId);
            if (idx !== -1) return { table: state.plan.tables[i], index: idx };
        }
        return null;
    }

    function nbPlaces() { return state.plan.tables.reduce(function (s, t) { return s + t.places; }, 0); }

    // Retire du plan les élèves supprimés de la liste, les doublons, les épingles d'élèves non placés
    // et les contraintes qui visent un élève disparu.
    function nettoyerPlan() {
        var vus = {};
        state.plan.tables.forEach(function (t) {
            t.eleves = t.eleves.map(function (id) {
                if (!id || vus[id] || !trouverEleve(id)) return null;
                vus[id] = true;
                return id;
            });
        });
        Object.keys(state.plan.epingles).forEach(function (id) { if (!vus[id]) delete state.plan.epingles[id]; });
        state.plan.contraintes = state.plan.contraintes.filter(function (c) { return c.a !== c.b && trouverEleve(c.a) && trouverEleve(c.b); });
    }

    // Prénom seul ; en cas de prénom partagé, on ajoute l'initiale du nom (ou le nom entier si l'initiale ne suffit pas).
    function nomPlan(el) {
        if (state.plan.affichage === 'prenomNom') return el.prenom + (el.nom ? ' ' + el.nom.toUpperCase() : '');
        var cle = normaliserTexte(el.prenom), initiale = normaliserTexte(el.nom).charAt(0);
        var homonymes = state.eleves.filter(function (e) { return e !== el && normaliserTexte(e.prenom) === cle; });
        if (!homonymes.length || !el.nom) return el.prenom;
        var memeInitiale = homonymes.some(function (e) { return normaliserTexte(e.nom).charAt(0) === initiale; });
        return el.prenom + ' ' + (memeInitiale ? el.nom.toUpperCase() : el.nom.charAt(0).toUpperCase() + '.');
    }

    function comparerPrenoms(a, b) {
        return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' }) || (a.nom || '').localeCompare(b.nom || '', 'fr');
    }

    function melanger(tableau) {
        var a = tableau.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    // ----- Tirage au sort -----

    // Ordre de remplissage des places : « devant d'abord » (rangée par rangée depuis le tableau)
    // ou « réparti » (une place par table d'abord, puis les places suivantes).
    function ordreSieges() {
        var tables = state.plan.tables.filter(function (t) { return t.type === 'table'; })
            .sort(function (a, b) { return a.y - b.y || a.x - b.x; });
        var liste = [];
        if (state.plan.remplissage === 'reparti') {
            for (var passe = 0; passe < MAX_PLACES_TABLE; passe++) {
                tables.forEach(function (t) { if (passe < t.places) liste.push({ table: t, index: passe }); });
            }
        } else {
            tables.forEach(function (t) { t.eleves.forEach(function (_, i) { liste.push({ table: t, index: i }); }); });
        }
        return liste;
    }

    function partenaires(id, type) {
        return state.plan.contraintes.filter(function (c) { return c.type === type && (c.a === id || c.b === id); })
            .map(function (c) { return c.a === id ? c.b : c.a; });
    }

    function conflitTable(id, table) {
        var aSeparer = partenaires(id, 'separer');
        return table.eleves.some(function (o) { return o && aSeparer.indexOf(o) !== -1; });
    }

    // Un tirage : place au hasard les élèves pas encore placés. Renvoie le nombre d'élèves restés sans place.
    function unTirage() {
        var aPlacer = melanger(state.eleves.filter(function (el) { return !placeDe(el.id); }));
        function sortir(id) {
            var k = aPlacer.findIndex(function (el) { return el.id === id; });
            if (k !== -1) aPlacer.splice(k, 1);
        }
        function libres(t) { return t.eleves.map(function (v, i) { return v ? -1 : i; }).filter(function (i) { return i !== -1; }); }
        var tables = melanger(state.plan.tables.filter(function (t) { return t.type === 'table'; }));

        // 1) « À mettre avec » d'abord : chaque paire est installée à une même table.
        melanger(state.plan.contraintes.filter(function (c) { return c.type === 'ensemble'; })).forEach(function (c) {
            var pa = placeDe(c.a), pb = placeDe(c.b);
            if (pa && pb) return;
            if (!pa && !pb) {
                var t = tables.find(function (t) { return libres(t).length >= 2 && !conflitTable(c.a, t) && !conflitTable(c.b, t); });
                if (!t) return;
                var l = libres(t);
                t.eleves[l[0]] = c.a; t.eleves[l[1]] = c.b;
                sortir(c.a); sortir(c.b);
            } else {
                var p = pa || pb, autre = pa ? c.b : c.a, places = libres(p.table);
                if (places.length && !conflitTable(autre, p.table)) { p.table.eleves[places[0]] = autre; sortir(autre); }
            }
        });

        // 2) Les autres élèves, place par place, en évitant « À séparer de » et en alternant filles / garçons.
        ordreSieges().forEach(function (s) {
            if (s.table.eleves[s.index] || !aPlacer.length) return;
            var candidats = aPlacer.filter(function (el) { return !conflitTable(el.id, s.table); });
            if (!candidats.length) candidats = aPlacer;
            var choix = candidats[0];
            if (state.plan.mixte) {
                var voisin = trouverEleve(s.table.eleves[s.index - 1] || s.table.eleves[s.index + 1]);
                var reste = function (garcon) { return aPlacer.filter(function (el) { return (el.genre === 'M') === garcon; }).length; };
                // Avec un voisin : l'autre genre ; sinon le genre le plus nombreux restant, pour garder des tables mixtes.
                var garcon = voisin ? voisin.genre !== 'M' : reste(true) > reste(false);
                choix = candidats.find(function (el) { return (el.genre === 'M') === garcon; }) || choix;
            }
            s.table.eleves[s.index] = choix.id;
            aPlacer.splice(aPlacer.indexOf(choix), 1);
        });
        return aPlacer.length;
    }

    function contraintesNonRespectees() {
        return state.plan.contraintes.filter(function (c) {
            var pa = placeDe(c.a), pb = placeDe(c.b);
            if (!pa || !pb) return false;
            return c.type === 'separer' ? pa.table === pb.table : pa.table !== pb.table;
        });
    }

    function libelleContrainte(c) {
        var a = trouverEleve(c.a), b = trouverEleve(c.b);
        return a && b ? a.prenom + (c.type === 'separer' ? ' / ' : ' + ') + b.prenom : '';
    }

    // complet : tout remélanger (sauf les élèves épinglés) ; sinon compléter les places libres.
    // Avec des contraintes, on fait plusieurs tirages et on garde celui qui en respecte le plus.
    function tirer(complet) {
        memoriserPlan();
        var tables = state.plan.tables;
        if (complet) tables.forEach(function (t) { t.eleves = t.eleves.map(function (id) { return id && state.plan.epingles[id] ? id : null; }); });
        var depart = tables.map(function (t) { return t.eleves.slice(); });
        var meilleur = null, essais = state.plan.contraintes.length ? 200 : 1;
        for (var k = 0; k < essais; k++) {
            tables.forEach(function (t, i) { t.eleves = depart[i].slice(); });
            var restants = unTirage(), echecs = contraintesNonRespectees().length;
            if (!meilleur || echecs < meilleur.echecs) meilleur = { echecs: echecs, restants: restants, etat: tables.map(function (t) { return t.eleves.slice(); }) };
            if (!echecs) break;
        }
        tables.forEach(function (t, i) { t.eleves = meilleur.etat[i]; });
        var messages = [];
        if (meilleur.restants) messages.push(meilleur.restants + ' élève' + (meilleur.restants > 1 ? 's n\'ont' : ' n\'a') + ' pas de place : ajoutez des tables à l\'étape 1.');
        var nonRespectees = contraintesNonRespectees();
        if (nonRespectees.length) messages.push('⚠️ ' + nonRespectees.length + ' contrainte' + (nonRespectees.length > 1 ? 's non respectées' : ' non respectée') + ' : ' + nonRespectees.map(libelleContrainte).join(', ') + '.');
        planMessage = messages.join(' ');
        planSelection = null;
        sauvegarder();
        rafraichirPlan();
    }

    // ----- État de l'interface et historique -----

    var planSelection = null;   // id de l'élève sélectionné (clic), en attente d'une place
    var planMessage = '';       // information ponctuelle affichée sous la barre d'outils
    var tableActive = null;     // table sélectionnée à l'étape 1 (poignée et boutons visibles)
    var pilePlan = [];          // historique pour « Annuler »

    function memoriserPlan() {
        pilePlan.push(JSON.stringify(state.plan));
        if (pilePlan.length > 40) pilePlan.shift();
    }

    function annulerPlan() {
        if (!pilePlan.length) return;
        state.plan = normaliserPlan(JSON.parse(pilePlan.pop()));
        planSelection = null;
        planMessage = '';
        sauvegarder();
        rafraichirPlan();
    }

    function placerEleve(eleveId, tableId, index) {
        var table = trouverTable(tableId);
        if (!table || !trouverEleve(eleveId)) return;
        var origine = placeDe(eleveId);
        if (origine && origine.table === table && origine.index === index) return;
        memoriserPlan();
        var occupant = table.eleves[index];
        table.eleves[index] = eleveId;
        // Échange : l'occupant prend l'ancienne place de l'élève déplacé (ou retourne dans la liste).
        if (origine) origine.table.eleves[origine.index] = occupant || null;
        planSelection = null;
        planMessage = '';
        sauvegarder();
        rafraichirPlan();
    }

    function retirerEleve(eleveId) {
        var origine = placeDe(eleveId);
        if (!origine) return;
        memoriserPlan();
        origine.table.eleves[origine.index] = null;
        if (planSelection === eleveId) planSelection = null;
        sauvegarder();
        rafraichirPlan();
    }

    function basculerEpingle(eleveId) {
        memoriserPlan();
        if (state.plan.epingles[eleveId]) delete state.plan.epingles[eleveId];
        else state.plan.epingles[eleveId] = true;
        sauvegarder();
        rafraichirPlan();
    }

    // Change le nombre de places d'une table en gardant la longueur de chaque place ; les élèves
    // des places supprimées retournent dans la liste.
    function changerPlaces(id, delta) {
        var t = trouverTable(id);
        var n = t ? Math.max(1, Math.min(MAX_PLACES_TABLE, t.places + delta)) : 0;
        if (!t || n === t.places) return;
        memoriserPlan();
        var vertical = t.h > t.w, long = vertical ? t.h : t.w;
        var nouveauLong = Math.max(PLACE_MIN * n, Math.round(long / t.places * n / PLAN_PAS) * PLAN_PAS);
        if (vertical) t.h = nouveauLong;
        else { t.w = Math.min(nouveauLong, PLAN_LARGEUR); t.x = Math.min(t.x, PLAN_LARGEUR - t.w); }
        t.eleves = Array.from({ length: n }, function (_, i) { return t.eleves[i] || null; });
        t.places = n;
        ajusterHauteurPlan();
        sauvegarder();
        rafraichirPlan();
        focusTable(id);
    }

    // Pivote une table ou un meuble d'un quart de tour autour de son centre.
    function pivoterTable(id) {
        var t = trouverTable(id);
        if (!t) return;
        memoriserPlan();
        var cx = t.x + t.w / 2, cy = t.y + t.h / 2, w = t.w;
        t.w = t.h; t.h = w;
        t.x = Math.max(0, Math.min(PLAN_LARGEUR - t.w, Math.round((cx - t.w / 2) / PLAN_PAS) * PLAN_PAS));
        t.y = Math.max(0, Math.round((cy - t.h / 2) / PLAN_PAS) * PLAN_PAS);
        ajusterHauteurPlan();
        sauvegarder();
        rafraichirPlan();
        focusTable(id);
    }

    // Supprime une table : ses élèves retournent dans la liste (Annuler permet de revenir en arrière).
    function supprimerTable(id) {
        memoriserPlan();
        state.plan.tables = state.plan.tables.filter(function (t) { return t.id !== id; });
        planMessage = 'Élément supprimé. « ↶ Annuler » pour le récupérer.';
        tableActive = null;
        sauvegarder();
        rafraichirPlan();
    }

    function renommerMeuble(id) {
        var t = trouverTable(id);
        if (!t) return;
        showPrompt('Renommer', 'Nom de cet élément :', t.label || MOBILIER[t.type].label, function (v) {
            memoriserPlan();
            t.label = v;
            sauvegarder();
            rafraichirPlan();
        });
    }

    function focusTable(id) {
        var el = document.querySelector('#planSalle .planTable[data-table="' + id + '"]');
        if (el) el.focus();
    }

    // ----- Rendu -----

    // Coordonnées affichées : en vue élèves, la salle est retournée (tableau en bas), le texte reste lisible.
    function positionAffichee(t, vueEleves) {
        var H = state.plan.hauteur;
        var x = vueEleves ? PLAN_LARGEUR - t.x - t.w : t.x;
        var y = vueEleves ? H - t.y - t.h : t.y;
        return 'left:' + (x / PLAN_LARGEUR * 100) + '%;top:' + (y / H * 100) + '%;' +
            'width:' + (t.w / PLAN_LARGEUR * 100) + '%;height:' + (t.h / H * 100) + '%;';
    }

    // o : { statique (impression), vide (sans prénoms), reperes (AESH / PAI), vueEleves }
    function htmlSiege(t, i, o) {
        var id = t.eleves[i], el = id && !o.vide ? trouverEleve(id) : null;
        var interactif = !o.statique && state.plan.mode === 'placer';
        var ouvre = o.statique ? '<div class="siegeNom"' : '<button type="button" class="siegeNom" tabindex="' + (interactif ? '0' : '-1') + '"';
        var ferme = o.statique ? '</div>' : '</button>';
        var attributs = ' data-table="' + t.id + '" data-index="' + i + '"';
        if (!el) {
            return '<div class="planSiege vide"' + attributs + '>' + ouvre + (o.statique ? '>' : ' aria-label="Place libre">') +
                (interactif ? '<span aria-hidden="true">+</span>' : '') + ferme + '</div>';
        }
        var reperes = o.reperes ? (el.aesh ? '<span class="siegeBadge">AESH</span>' : '') + (el.pai ? '<span class="siegeBadge pai">PAI</span>' : '') : '';
        var epingle = !!state.plan.epingles[id];
        return '<div class="planSiege occupe ' + (el.genre === 'M' ? 'garcon' : 'fille') + (!o.statique && planSelection === id ? ' selectionne' : '') + (epingle ? ' epingle' : '') + '"' + attributs + '>' +
            ouvre + (o.statique ? '>' : ' data-eleve="' + id + '" title="' + escapeHtml(el.prenom + ' ' + (el.nom || '').toUpperCase()) + '">') +
            '<span class="siegeTexte">' + escapeHtml(nomPlan(el)) + '</span>' + reperes + ferme +
            (interactif ? '<button type="button" class="siegeEpingler" data-eleve="' + id + '" aria-pressed="' + epingle + '" title="' + (epingle ? 'Désépingler' : 'Épingler : le tirage ne déplacera pas cet élève') + '" aria-label="Épingler ' + escapeHtml(el.prenom) + '">📌</button>' +
                '<button type="button" class="siegeRetirer" data-eleve="' + id + '" title="Remettre dans la liste" aria-label="Remettre ' + escapeHtml(el.prenom) + ' dans la liste">×</button>'
                : (epingle && !o.statique ? '<span class="siegePunaise" aria-hidden="true">📌</span>' : '')) +
            '</div>';
    }

    function htmlActions(t) {
        var b = function (action, texte, titre, inactif) {
            return '<button type="button" data-action="' + action + '" title="' + titre + '" aria-label="' + titre + '"' + (inactif ? ' disabled' : '') + '>' + texte + '</button>';
        };
        return '<div class="planActions">' +
            (t.type === 'table' ? b('moins', '−', 'Retirer une place (touche −)', t.places <= 1) + '<span class="planNbPlaces">' + t.places + '</span>' + b('plus', '+', 'Ajouter une place (touche +)', t.places >= MAX_PLACES_TABLE) : '') +
            (t.type === 'divers' ? b('renommer', '✎', 'Renommer') : '') +
            b('pivoter', '⟳', 'Pivoter (touche R)') + b('supprimer', '✕', 'Supprimer (touche Suppr)') +
            '</div><span class="planPoignee" title="Glisser pour redimensionner (Maj + flèches)"></span>';
    }

    function htmlSalle(o) {
        var p = state.plan;
        if (!p.tables.length && !o.statique) {
            return '<div class="planAccueil"><h3>Commencez par choisir une disposition</h3>' +
                '<p>Elle est calculée pour vos ' + (state.eleves.length || 24) + ' élèves ; vous pourrez ensuite déplacer, redimensionner, ajouter ou supprimer des tables.</p>' +
                '<div class="planAccueilChoix">' + Object.keys(DISPOSITIONS).map(function (cle) {
                    return '<button type="button" class="planChoixDispo" data-dispo="' + cle + '">' + iconeDisposition(cle) +
                        '<strong>' + DISPOSITIONS[cle].label + '</strong><small>' + DISPOSITIONS[cle].desc + '</small></button>';
                }).join('') + '</div></div>';
        }
        var amenager = !o.statique && p.mode === 'amenager';
        return '<div class="planTableau' + (o.vueEleves ? ' enBas' : '') + '">Tableau</div>' +
            p.tables.map(function (t) {
                var meuble = t.type !== 'table';
                var contenu = meuble ? '<span class="planMeubleLabel">' + escapeHtml(nomMeuble(t)) + '</span>'
                    : t.eleves.map(function (_, i) { return htmlSiege(t, i, o); }).join('');
                return '<div class="planTable type-' + t.type + (meuble ? ' meuble' : '') + (t.h > t.w ? ' vertical' : '') + (amenager && tableActive === t.id ? ' actif' : '') +
                    // Près du haut de la salle, la barre d'actions passe sous l'élément pour rester visible.
                    ((o.vueEleves ? p.hauteur - t.y - t.h : t.y) < 50 ? ' actionsDessous' : '') + '"' +
                    ' data-table="' + t.id + '" style="' + positionAffichee(t, o.vueEleves) + '"' +
                    (amenager ? ' tabindex="0" role="group" aria-label="' + escapeHtml(meuble ? nomMeuble(t) : 'Table à ' + t.places + ' place' + (t.places > 1 ? 's' : '')) + '"' : '') + '>' +
                    contenu + (amenager ? htmlActions(t) : '') + '</div>';
            }).join('');
    }

    function iconeDisposition(cle) {
        var r = function (x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5"/>'; };
        var formes = {
            rangees: [2, 20, 38].map(function (x) { return [8, 20, 32].map(function (y) { return r(x, y, 12, 6); }).join(''); }).join(''),
            ilots: r(8, 10, 14, 7) + r(8, 17, 14, 7) + r(30, 10, 14, 7) + r(30, 17, 14, 7) + r(8, 30, 14, 7) + r(8, 37, 14, 7) + r(30, 30, 14, 7) + r(30, 37, 14, 7),
            u: [10, 18, 26, 34].map(function (y) { return r(3, y, 7, 6) + r(42, y, 7, 6); }).join('') + [10, 18, 26, 34].map(function (x) { return r(x, 42, 7, 5); }).join(''),
            simples: [3, 13, 23, 33, 43].map(function (x) { return [8, 20, 32].map(function (y) { return r(x, y, 7, 6); }).join(''); }).join('')
        };
        return '<svg class="iconeDispo" viewBox="0 0 52 50" aria-hidden="true"><rect x="16" y="1" width="20" height="3" rx="1" class="iconeTableau"/>' + formes[cle] + '</svg>';
    }

    function htmlListePlan() {
        if (!state.eleves.length) return '<p class="planListeVide">Aucun élève : ajoutez-les avec le formulaire en haut de page ou importez une liste CSV.</p>';
        var filtre = normaliserTexte(($('planRecherche') || {}).value || '');
        var tries = state.eleves.slice().sort(comparerPrenoms)
            .filter(function (el) { return !filtre || normaliserTexte(el.prenom + el.nom).indexOf(filtre) !== -1; });
        function chip(el, place) {
            return '<li><button type="button" class="chipEleve ' + (el.genre === 'M' ? 'garcon' : 'fille') + (place ? ' place' : '') + (planSelection === el.id ? ' selectionne' : '') + '"' +
                ' data-eleve="' + el.id + '" aria-pressed="' + (planSelection === el.id) + '">' +
                '<span class="chipNom">' + escapeHtml(el.prenom) + ' <span class="chipNomFamille">' + escapeHtml((el.nom || '').toUpperCase()) + '</span></span>' +
                (state.plan.epingles[el.id] ? '<span aria-label="épinglé">📌</span>' : '') +
                (place ? '<span class="chipPlace" aria-label="placé">✓</span>' : '') + '</button></li>';
        }
        var nonPlaces = tries.filter(function (el) { return !placeDe(el.id); });
        var places = tries.filter(function (el) { return placeDe(el.id); });
        return '<h3 class="planListeTitre">À placer <span class="countBadge">' + nonPlaces.length + '</span></h3>' +
            '<ul class="planChips">' + (nonPlaces.map(function (el) { return chip(el, false); }).join('') || '<li class="planListeVide">' + (filtre ? 'Aucun résultat' : 'Tous les élèves sont placés 🎉') + '</li>') + '</ul>' +
            (places.length ? '<h3 class="planListeTitre">Déjà placés <span class="countBadge neutre">' + places.length + '</span></h3>' +
                '<ul class="planChips">' + places.map(function (el) { return chip(el, true); }).join('') + '</ul>' : '');
    }

    function htmlOutilsPlan() {
        var p = state.plan, places = nbPlaces(), n = state.eleves.length;
        var capacite = '<span class="planCapacite' + (places < n ? ' manque' : '') + '">' + places + ' place' + (places > 1 ? 's' : '') + ' · ' + n + ' élève' + (n > 1 ? 's' : '') + '</span>';
        if (p.mode === 'amenager') {
            return '<div class="dropdown">' +
                '<button type="button" class="softButton" id="btnMenuDispo" aria-haspopup="true" aria-expanded="false" aria-controls="menuDispo">🪑 Disposition type <span aria-hidden="true">▾</span></button>' +
                '<div class="dropdownMenu" id="menuDispo" hidden>' + Object.keys(DISPOSITIONS).map(function (cle) {
                    return '<button type="button" data-dispo="' + cle + '">' + iconeDisposition(cle) + '<span>' + DISPOSITIONS[cle].label + '</span></button>';
                }).join('') + '</div></div>' +
                '<button type="button" class="softButton" id="btnAjoutDouble">+ Table double</button>' +
                '<button type="button" class="softButton" id="btnAjoutSimple">+ Table individuelle</button>' +
                '<div class="dropdown">' +
                '<button type="button" class="softButton" id="btnMenuMobilier" aria-haspopup="true" aria-expanded="false" aria-controls="menuMobilier">+ Mobilier <span aria-hidden="true">▾</span></button>' +
                '<div class="dropdownMenu" id="menuMobilier" hidden>' + Object.keys(MOBILIER).map(function (type) {
                    return '<button type="button" data-meuble="' + type + '">' + MOBILIER[type].icone + ' ' + (type === 'divers' ? 'Autre (à nommer)…' : MOBILIER[type].label) + '</button>';
                }).join('') + '</div></div>' +
                capacite;
        }
        var nbContraintes = p.contraintes.length;
        return '<button type="button" class="softButton accent" id="btnPlacerRestants"' + (n ? '' : ' disabled') + '>🎲 Placer les élèves restants</button>' +
            '<button type="button" class="softButton" id="btnNouveauTirage"' + (n ? '' : ' disabled') + ' title="Remélange toute la classe, sauf les élèves épinglés 📌">🔀 Nouveau tirage</button>' +
            '<button type="button" class="softButton" id="btnContraintes"' + (n > 1 ? '' : ' disabled') + '>🤝 Contraintes' + (nbContraintes ? ' <span class="pastilleNombre">' + nbContraintes + '</span>' : '') + '</button>' +
            '<div class="dropdown">' +
            '<button type="button" class="softButton" id="btnMenuTirage" aria-haspopup="true" aria-expanded="false" aria-controls="menuTirage">⚙️ Options du tirage <span aria-hidden="true">▾</span></button>' +
            '<div class="dropdownMenu menuReglages" id="menuTirage" hidden>' +
            '<label class="checkLabel"><input type="checkbox" id="chkMixte"' + (p.mixte ? ' checked' : '') + '> Alterner filles / garçons</label>' +
            '<label class="reglage">Remplissage<select id="selRemplissage" class="selectNiveau">' +
            '<option value="devant"' + (p.remplissage === 'devant' ? ' selected' : '') + '>Devant d\'abord</option>' +
            '<option value="reparti"' + (p.remplissage === 'reparti' ? ' selected' : '') + '>Réparti dans la salle</option></select></label>' +
            '<p class="reglageAide">« Réparti » occupe d\'abord une place par table : utile quand il y a plus de places que d\'élèves.</p>' +
            '</div></div>' +
            '<button type="button" class="softButton danger" id="btnViderPlacement">Tout remettre dans la liste</button>' +
            capacite;
    }

    function messagePlan() {
        if (planSelection) {
            var el = trouverEleve(planSelection);
            if (el) return '👉 <strong>' + escapeHtml(el.prenom) + '</strong> sélectionné(e) : cliquez sur une place (ou sur un autre élève pour échanger). Échap pour annuler.';
        }
        if (planMessage) return escapeHtml(planMessage);
        if (!state.plan.tables.length) return '';
        return state.plan.mode === 'amenager'
            ? 'Glissez les tables pour les déplacer ; cliquez sur une table pour la redimensionner (poignée ◢) ou changer son nombre de places. Vous pouvez déjà glisser des élèves sur les places.'
            : 'Glissez un prénom sur une place (au doigt : appui long puis glisser), ou touchez l\'élève puis la place. Déposer sur un élève déjà assis les échange.';
    }

    function htmlImpressionPlan() {
        var p = state.plan, o = p.export;
        if (!p.tables.length) return '';
        return '<div class="enteteFeuille"><h2>' + escapeHtml(o.titre || 'Plan de classe') + '</h2><div class="dateFeuille">' + escapeHtml(formatDateLongue(aujourdHuiISO())) + '</div></div>' +
            '<div class="planSalle statique' + (p.couleurs.actif && !o.vide ? ' avecCouleurs' : '') + (o.vueEleves ? ' vueEleves' : '') + '" style="--ratio:' + PLAN_LARGEUR + ' / ' + p.hauteur + ';--ratio-num:' + (PLAN_LARGEUR / p.hauteur) + '">' +
            htmlSalle({ statique: true, vide: o.vide, reperes: o.reperes && !o.vide, vueEleves: o.vueEleves }) + '</div>';
    }

    function appliquerCouleurs() {
        var c = state.plan.couleurs, panel = $('panel-plan');
        panel.style.setProperty('--coul-F', c.F);
        panel.style.setProperty('--coul-M', c.M);
        if ($('chkCouleurs')) {
            $('chkCouleurs').checked = c.actif;
            $('coulF').value = c.F;
            $('coulM').value = c.M;
        }
    }

    // Met à jour tout le plan sauf le champ de recherche (qui garde le focus pendant la saisie).
    function rafraichirPlan() {
        if (!$('planSalle')) return;
        nettoyerPlan();
        var p = state.plan;
        document.querySelectorAll('.planMode button').forEach(function (b) {
            b.setAttribute('aria-pressed', b.dataset.mode === p.mode ? 'true' : 'false');
        });
        $('planOutils').innerHTML = htmlOutilsPlan();
        ['Dispo', 'Mobilier', 'Tirage'].forEach(function (nom) {
            if ($('btnMenu' + nom)) initMenuDeroulant('btnMenu' + nom, 'menu' + nom);
        });
        // Les réglages se modifient sans refermer le menu.
        if ($('menuTirage')) $('menuTirage').addEventListener('click', function (e) { e.stopPropagation(); });
        $('planMessage').innerHTML = messagePlan();
        $('planMessage').hidden = !$('planMessage').innerHTML;
        planMessage = ''; // message ponctuel : affiché une seule fois
        $('btnAnnulerPlan').disabled = !pilePlan.length;
        $('btnVueEleves').setAttribute('aria-pressed', p.vueEleves ? 'true' : 'false');
        $('planAffichage').value = p.affichage;
        appliquerCouleurs();
        var salle = $('planSalle');
        salle.className = 'planSalle mode-' + p.mode + (p.tables.length ? '' : ' vide') + (planSelection ? ' enSelection' : '') +
            (p.couleurs.actif ? ' avecCouleurs' : '') + (p.vueEleves ? ' vueEleves' : '');
        salle.style.setProperty('--ratio', PLAN_LARGEUR + ' / ' + p.hauteur);
        salle.style.setProperty('--ratio-num', PLAN_LARGEUR / p.hauteur);
        salle.innerHTML = htmlSalle({ statique: false, vide: false, reperes: !p.vueEleves, vueEleves: p.vueEleves });
        $('planListe').className = 'planListe' + (p.couleurs.actif ? ' avecCouleurs' : '');
        $('planListe').innerHTML = htmlListePlan();
        $('planImpression').innerHTML = htmlImpressionPlan();
    }

    function renderPlanClasse() {
        var panel = $('panel-plan');
        state.plan = normaliserPlan(state.plan);
        if (!state.plan.tables.length) state.plan.mode = 'amenager';
        var c = state.plan.couleurs;
        panel.innerHTML =
            '<details class="planNotice no-print"' + (state.plan.noticeOuverte ? ' open' : '') + '>' +
            '<summary>📖 Mode d\'emploi</summary><ol>' +
            '<li><strong>Aménager la salle</strong> : choisissez une disposition, puis déplacez les tables à la souris ou au doigt. Cliquez sur une table pour la redimensionner (poignée ◢ en bas à droite), changer son nombre de places (− / +), la pivoter ⟳ ou la supprimer ✕. « + Mobilier » ajoute bureau, porte, fenêtre, armoire…</li>' +
            '<li><strong>Placer les élèves</strong> : glissez un prénom de la liste sur une place (au doigt : appui long, puis glisser), ou touchez l\'élève puis la place. Déposer sur un élève assis les échange, × le remet dans la liste, 📌 l\'épingle à sa place.</li>' +
            '<li><strong>Tirer au sort</strong> : « Placer les élèves restants » complète les places libres ; « Nouveau tirage » remélange tout, sauf les élèves épinglés. « Contraintes » : élèves à séparer ou à mettre ensemble.</li>' +
            '<li><strong>Finaliser</strong> : ↶ Annuler (Ctrl+Z) à tout moment, 👁️ Vue élèves pour projeter le plan, 🖨️ pour imprimer (plan vide ou rempli), enregistrer en PDF ou en image PNG.</li>' +
            '</ol></details>' +
            '<div class="planBarre no-print">' +
            '<div class="planMode" role="group" aria-label="Étape">' +
            '<button type="button" data-mode="amenager"><span class="planModeNum">1</span> Aménager la salle</button>' +
            '<button type="button" data-mode="placer"><span class="planModeNum">2</span> Placer les élèves</button>' +
            '</div>' +
            '<div class="planBarreDroite">' +
            '<button type="button" class="softButton" id="btnAnnulerPlan" title="Annuler la dernière action (Ctrl+Z)">↶ Annuler</button>' +
            '<button type="button" class="softButton" id="btnVueEleves" aria-pressed="false" title="Retourne le plan (tableau en bas) pour le projeter aux élèves">👁️ Vue élèves</button>' +
            '<div class="dropdown">' +
            '<button type="button" class="softButton" id="btnMenuCouleurs" aria-haspopup="true" aria-expanded="false" aria-controls="menuCouleurs">🎨 Couleurs <span aria-hidden="true">▾</span></button>' +
            '<div class="dropdownMenu menuReglages alignDroite" id="menuCouleurs" hidden>' +
            '<label class="checkLabel"><input type="checkbox" id="chkCouleurs"' + (c.actif ? ' checked' : '') + '> Couleurs filles / garçons</label>' +
            '<label class="reglage reglageCouleur"><input type="color" id="coulF" value="' + c.F + '"> Filles</label>' +
            '<label class="reglage reglageCouleur"><input type="color" id="coulM" value="' + c.M + '"> Garçons</label>' +
            '<button type="button" class="softButton" id="btnCouleursDefaut">Couleurs d\'origine</button>' +
            '</div></div>' +
            '<select id="planAffichage" class="selectNiveau" aria-label="Affichage des noms"><option value="prenom">Prénom</option><option value="prenomNom">Prénom NOM</option></select>' +
            '<button type="button" class="softButton accent" id="btnExporterPlan">🖨️ Imprimer / exporter</button>' +
            '</div></div>' +
            '<div class="planOutils no-print" id="planOutils"></div>' +
            '<p class="planMessage no-print" id="planMessage" role="status" aria-live="polite"></p>' +
            '<div class="planLayout no-print">' +
            '<aside class="planLateral" aria-label="Élèves de la classe">' +
            '<input type="search" id="planRecherche" class="planRecherche" placeholder="🔍 Rechercher un élève" aria-label="Rechercher un élève">' +
            '<div id="planListe" class="planListe"></div>' +
            '</aside>' +
            '<div class="planZone"><div id="planSalle" class="planSalle"></div></div>' +
            '</div>' +
            '<div class="planImpression print-only" id="planImpression"></div>';

        panel.querySelector('.planNotice').addEventListener('toggle', function () {
            state.plan.noticeOuverte = this.open;
            sauvegarder();
        });
        panel.querySelector('.planMode').addEventListener('click', function (e) {
            var b = e.target.closest('button[data-mode]');
            if (b) changerModePlan(b.dataset.mode);
        });
        $('btnAnnulerPlan').addEventListener('click', annulerPlan);
        $('btnVueEleves').addEventListener('click', function () {
            state.plan.vueEleves = !state.plan.vueEleves;
            sauvegarder();
            rafraichirPlan();
        });
        $('planAffichage').addEventListener('change', function () {
            state.plan.affichage = this.value;
            sauvegarder();
            rafraichirPlan();
        });
        initMenuDeroulant('btnMenuCouleurs', 'menuCouleurs');
        $('menuCouleurs').addEventListener('click', function (e) { e.stopPropagation(); });
        $('menuCouleurs').addEventListener('input', function () {
            state.plan.couleurs = { actif: $('chkCouleurs').checked, F: $('coulF').value, M: $('coulM').value };
            sauvegarder();
            appliquerCouleurs();
            $('planSalle').classList.toggle('avecCouleurs', state.plan.couleurs.actif);
            $('planListe').classList.toggle('avecCouleurs', state.plan.couleurs.actif);
        });
        $('chkCouleurs').addEventListener('change', function () { $('menuCouleurs').dispatchEvent(new Event('input')); });
        $('btnCouleursDefaut').addEventListener('click', function () {
            $('coulF').value = COULEURS_DEFAUT.F;
            $('coulM').value = COULEURS_DEFAUT.M;
            $('chkCouleurs').checked = true;
            $('menuCouleurs').dispatchEvent(new Event('input'));
        });
        $('btnExporterPlan').addEventListener('click', ouvrirExportPlan);
        $('planRecherche').addEventListener('input', function () { $('planListe').innerHTML = htmlListePlan(); });

        $('planOutils').addEventListener('click', function (e) {
            var dispo = e.target.closest('[data-dispo]');
            if (dispo) { appliquerDisposition(dispo.dataset.dispo); return; }
            var meuble = e.target.closest('[data-meuble]');
            if (meuble) {
                var type = meuble.dataset.meuble;
                if (type === 'divers') showPrompt('Nouvel élément', 'Nom de l\'élément (coin lecture, évier, TBI…) :', '', function (v) { ajouterElement(nouveauMeuble('divers', v)); });
                else ajouterElement(nouveauMeuble(type));
                return;
            }
            var id = e.target.closest('button') && e.target.closest('button').id;
            if (id === 'btnAjoutDouble') ajouterElement(nouvelleTable(0, 0, 2));
            if (id === 'btnAjoutSimple') ajouterElement(nouvelleTable(0, 0, 1));
            if (id === 'btnPlacerRestants') tirer(false);
            if (id === 'btnNouveauTirage') tirer(true);
            if (id === 'btnContraintes') ouvrirContraintes();
            if (id === 'btnViderPlacement') {
                memoriserPlan();
                state.plan.tables.forEach(function (t) { t.eleves = t.eleves.map(function () { return null; }); });
                planSelection = null;
                sauvegarder();
                rafraichirPlan();
            }
        });
        $('planOutils').addEventListener('change', function (e) {
            if (e.target.id === 'chkMixte') state.plan.mixte = e.target.checked;
            if (e.target.id === 'selRemplissage') state.plan.remplissage = e.target.value;
            sauvegarder();
        });

        // --- Liste des élèves : clic pour sélectionner (le glisser est géré plus bas, pour tout le document) ---
        $('planListe').addEventListener('click', function (e) {
            var chip = e.target.closest('.chipEleve');
            if (!chip || Date.now() < ignorerClicJusqua) return;
            var id = chip.dataset.eleve;
            // Élève sélectionné puis clic sur un élève déjà placé : échange de places.
            if (planSelection && planSelection !== id && placeDe(id)) {
                var cible = placeDe(id);
                placerEleve(planSelection, cible.table.id, cible.index);
                return;
            }
            planSelection = planSelection === id ? null : id;
            // À l'étape 1, choisir un élève fait passer à l'étape 2 (les places y deviennent cliquables).
            if (planSelection && state.plan.mode === 'amenager' && state.plan.tables.length) state.plan.mode = 'placer';
            rafraichirPlan();
        });

        // --- Salle : clics (placement, actions sur les tables, choix de disposition) ---
        var salle = $('planSalle');
        salle.addEventListener('click', function (e) {
            if (Date.now() < ignorerClicJusqua) return;
            var dispo = e.target.closest('[data-dispo]');
            if (dispo) { appliquerDisposition(dispo.dataset.dispo); return; }
            var action = e.target.closest('.planActions button');
            if (action) {
                var tid = action.closest('.planTable').dataset.table;
                ({ moins: function () { changerPlaces(tid, -1); }, plus: function () { changerPlaces(tid, 1); },
                    pivoter: function () { pivoterTable(tid); }, supprimer: function () { supprimerTable(tid); },
                    renommer: function () { renommerMeuble(tid); } })[action.dataset.action]();
                return;
            }
            if (state.plan.mode !== 'placer') return;
            var bouton = e.target.closest('.siegeRetirer, .siegeEpingler');
            if (bouton) {
                if (bouton.classList.contains('siegeRetirer')) retirerEleve(bouton.dataset.eleve);
                else basculerEpingle(bouton.dataset.eleve);
                return;
            }
            var siege = e.target.closest('.planSiege');
            if (!siege) return;
            var occupant = siege.querySelector('.siegeNom[data-eleve]');
            if (planSelection) {
                if (occupant && occupant.dataset.eleve === planSelection) planSelection = null;
                else { placerEleve(planSelection, siege.dataset.table, parseInt(siege.dataset.index, 10)); return; }
            } else if (occupant) {
                planSelection = occupant.dataset.eleve;
            } else {
                planMessage = 'Sélectionnez d\'abord un élève dans la liste, puis cliquez sur cette place.';
            }
            rafraichirPlan();
        });

        // --- Étape 1 : déplacer ou redimensionner une table à la souris ou au doigt ---
        var drag = null;
        salle.addEventListener('pointerdown', function (e) {
            if (state.plan.mode !== 'amenager' || e.button !== 0 || e.target.closest('.planActions')) return;
            var el = e.target.closest('.planTable');
            if (!el) {
                if (tableActive) { tableActive = null; rafraichirPlan(); }
                return;
            }
            var t = trouverTable(el.dataset.table);
            drag = { el: el, t: t, taille: !!e.target.closest('.planPoignee'), px: e.clientX, py: e.clientY,
                x: t.x, y: t.y, w: t.w, h: t.h, rect: salle.getBoundingClientRect(), bouge: false, avant: JSON.stringify(state.plan) };
            el.setPointerCapture(e.pointerId);
            el.classList.add('deplacement');
            e.preventDefault();
        });
        salle.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var vue = state.plan.vueEleves, H = state.plan.hauteur, t = drag.t;
            var dx = (e.clientX - drag.px) / drag.rect.width * PLAN_LARGEUR, dy = (e.clientY - drag.py) / drag.rect.height * H;
            if (Math.abs(e.clientX - drag.px) + Math.abs(e.clientY - drag.py) > 4) drag.bouge = true;
            var aimante = function (v) { return Math.round(v / PLAN_PAS) * PLAN_PAS; };
            if (drag.taille) {
                // La poignée est en bas à droite de ce qui est affiché : en vue élèves, cela correspond au coin haut gauche.
                var lim = limitesTaille(t);
                var w = Math.max(lim.court, aimante(drag.w + dx)), h = Math.max(lim.court, aimante(drag.h + dy));
                if (Math.max(w, h) < lim.long) { if (w >= h) w = lim.long; else h = lim.long; }
                t.w = Math.min(w, vue ? drag.x + drag.w : PLAN_LARGEUR - drag.x);
                t.h = Math.min(h, vue ? drag.y + drag.h : H - drag.y);
                if (vue) { t.x = drag.x + drag.w - t.w; t.y = drag.y + drag.h - t.h; }
                drag.el.classList.toggle('vertical', t.h > t.w);
            } else {
                var sens = vue ? -1 : 1;
                t.x = Math.max(0, Math.min(PLAN_LARGEUR - t.w, aimante(drag.x + dx * sens)));
                t.y = Math.max(0, Math.min(H - t.h, aimante(drag.y + dy * sens)));
            }
            drag.el.style.cssText = positionAffichee(t, vue);
        });
        function finDeplacement() {
            if (!drag) return;
            var d = drag;
            drag = null;
            d.el.classList.remove('deplacement');
            if (d.bouge) {
                pilePlan.push(d.avant);
                if (pilePlan.length > 40) pilePlan.shift();
                ajusterHauteurPlan();
                sauvegarder();
            }
            tableActive = d.t.id;
            rafraichirPlan();
            focusTable(d.t.id);
        }
        salle.addEventListener('pointerup', finDeplacement);
        salle.addEventListener('pointercancel', finDeplacement);
        salle.addEventListener('focusin', function (e) {
            var el = e.target.closest('.planTable');
            if (!el || state.plan.mode !== 'amenager') return;
            tableActive = el.dataset.table;
            salle.querySelectorAll('.planTable.actif').forEach(function (a) { if (a !== el) a.classList.remove('actif'); });
            el.classList.add('actif');
        });

        // --- Clavier sur une table (étape 1) : flèches, Maj + flèches, + / −, R, Suppr ---
        salle.addEventListener('keydown', function (e) {
            var el = e.target.closest('.planTable');
            if (!el || e.target !== el || state.plan.mode !== 'amenager') return;
            var t = trouverTable(el.dataset.table), sens = state.plan.vueEleves ? -1 : 1;
            var fleche = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (fleche) {
                e.preventDefault();
                memoriserPlan();
                if (e.shiftKey) {
                    var lim = limitesTaille(t);
                    t.w = Math.max(lim.court, Math.min(PLAN_LARGEUR - t.x, t.w + fleche[0] * PLAN_PAS));
                    t.h = Math.max(lim.court, t.h + fleche[1] * PLAN_PAS);
                    if (Math.max(t.w, t.h) < lim.long) { if (t.w >= t.h) t.w = lim.long; else t.h = lim.long; }
                } else {
                    t.x = Math.max(0, Math.min(PLAN_LARGEUR - t.w, t.x + fleche[0] * PLAN_PAS * sens));
                    t.y = Math.max(0, t.y + fleche[1] * PLAN_PAS * sens);
                }
                ajusterHauteurPlan();
                sauvegarder();
                rafraichirPlan();
                focusTable(t.id);
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                pivoterTable(t.id);
            } else if (e.key === '+' || e.key === '-') {
                e.preventDefault();
                changerPlaces(t.id, e.key === '+' ? 1 : -1);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                supprimerTable(t.id);
            }
        });

        rafraichirPlan();
    }

    function changerModePlan(mode) {
        if (mode === state.plan.mode) return;
        if (mode === 'placer' && !state.plan.tables.length) {
            planMessage = 'Choisissez d\'abord une disposition de salle.';
            rafraichirPlan();
            return;
        }
        state.plan.mode = mode;
        planSelection = null;
        tableActive = null;
        sauvegarder();
        rafraichirPlan();
    }

    // ----- Glisser un élève (liste → place, place → place, place → liste), souris, doigt et stylet -----
    // Souris : le glisser démarre après quelques pixels. Doigt / stylet : après un appui long, pour laisser
    // le défilement normal de la liste. Écouteurs posés une seule fois, sur le document.

    var glisse = null;
    var ignorerClicJusqua = 0;

    function dansRect(el, x, y) {
        var r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function siegeSous(x, y) {
        var el = document.elementFromPoint(x, y);
        var table = el && el.closest('#planSalle .planTable');
        if (!table) return null;
        return Array.prototype.find.call(table.querySelectorAll('.planSiege'), function (s) { return dansRect(s, x, y); }) || null;
    }

    function activerGlisse() {
        var el = trouverEleve(glisse.id);
        if (!el) { arreterGlisse(); return; }
        glisse.actif = true;
        glisse.fantome = document.createElement('div');
        glisse.fantome.className = 'fantomeEleve ' + (el.genre === 'M' ? 'garcon' : 'fille');
        glisse.fantome.textContent = nomPlan(el);
        document.body.appendChild(glisse.fantome);
        glisse.src.classList.add('glisse');
        document.body.classList.add('glisseEnCours');
        suivreGlisse();
        requestAnimationFrame(defilementAuto);
    }

    function suivreGlisse() {
        var x = glisse.px, y = glisse.py;
        glisse.fantome.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        var cible = siegeSous(x, y);
        document.querySelectorAll('.planSiege.survol').forEach(function (s) { if (s !== cible) s.classList.remove('survol'); });
        if (cible) cible.classList.add('survol');
        var liste = $('planListe');
        if (liste) liste.classList.toggle('survol', !!placeDe(glisse.id) && dansRect(liste, x, y));
    }

    // Tant qu'on glisse près d'un bord, la liste (ou la page) défile toute seule.
    function defilementAuto() {
        if (!glisse || !glisse.actif) return;
        var liste = $('planListe'), x = glisse.px, y = glisse.py;
        if (liste) {
            var r = liste.getBoundingClientRect();
            if (x >= r.left && x <= r.right) {
                if (y < r.top + 36 && y > r.top - 30) liste.scrollTop -= 10;
                else if (y > r.bottom - 36 && y < r.bottom + 30) liste.scrollTop += 10;
            }
        }
        if (y < 36) window.scrollBy(0, -12);
        else if (y > window.innerHeight - 36) window.scrollBy(0, 12);
        requestAnimationFrame(defilementAuto);
    }

    function arreterGlisse() {
        if (!glisse) return;
        clearTimeout(glisse.minuteur);
        if (glisse.fantome) glisse.fantome.remove();
        glisse.src.classList.remove('glisse');
        document.body.classList.remove('glisseEnCours');
        document.querySelectorAll('.planSiege.survol, .planListe.survol').forEach(function (s) { s.classList.remove('survol'); });
        glisse = null;
    }

    document.addEventListener('pointerdown', function (e) {
        if (state.activeTab !== 'plan' || e.button > 0 || glisse) return;
        if (e.target.closest('.siegeRetirer, .siegeEpingler')) return;
        var src = e.target.closest('#planListe .chipEleve, #planSalle.mode-placer .siegeNom[data-eleve]');
        if (!src) return;
        glisse = { id: src.dataset.eleve, src: src, x0: e.clientX, y0: e.clientY, px: e.clientX, py: e.clientY, actif: false, tactile: e.pointerType !== 'mouse' };
        if (glisse.tactile) glisse.minuteur = setTimeout(function () { if (glisse && !glisse.actif) activerGlisse(); }, 300);
    });

    document.addEventListener('pointermove', function (e) {
        if (!glisse) return;
        glisse.px = e.clientX;
        glisse.py = e.clientY;
        if (!glisse.actif) {
            var distance = Math.abs(e.clientX - glisse.x0) + Math.abs(e.clientY - glisse.y0);
            if (glisse.tactile) { if (distance > 10) arreterGlisse(); return; }   // le doigt fait défiler la page
            if (distance < 6) return;
            activerGlisse();
        }
        if (glisse) suivreGlisse();
    });

    document.addEventListener('pointerup', function (e) {
        if (!glisse) return;
        var g = glisse;
        arreterGlisse();
        if (!g.actif) return;
        ignorerClicJusqua = Date.now() + 400;   // le relâchement ne doit pas compter comme un clic
        var cible = siegeSous(e.clientX, e.clientY), liste = $('planListe');
        if (cible) placerEleve(g.id, cible.dataset.table, parseInt(cible.dataset.index, 10));
        else if (liste && dansRect(liste, e.clientX, e.clientY)) retirerEleve(g.id);
    });

    document.addEventListener('pointercancel', arreterGlisse);
    // Une fois le glisser lancé au doigt, on empêche la page de défiler sous le doigt.
    document.addEventListener('touchmove', function (e) { if (glisse && glisse.actif) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function (e) { if (glisse) e.preventDefault(); });

    // ----- Contraintes : élèves à séparer / à mettre ensemble -----

    function ouvrirContraintes() {
        var options = state.eleves.slice().sort(comparerPrenoms).map(function (el) {
            return '<option value="' + el.id + '">' + escapeHtml(el.prenom + (el.nom ? ' ' + el.nom.toUpperCase() : '')) + '</option>';
        }).join('');
        ouvrirModale(
            '<h3>🤝 Contraintes de placement</h3>' +
            '<p>Le tirage au sort en tient compte au mieux : deux élèves « à séparer » ne sont pas à la même table, deux élèves « à mettre ensemble » partagent une table. Les élèves épinglés 📌 restent prioritaires.</p>' +
            '<div class="contrainteForm">' +
            '<select id="contrA" class="selectNiveau" aria-label="Premier élève">' + options + '</select>' +
            '<select id="contrType" class="selectNiveau" aria-label="Type de contrainte"><option value="separer">🚫 à séparer de</option><option value="ensemble">🤝 à mettre avec</option></select>' +
            '<select id="contrB" class="selectNiveau" aria-label="Second élève">' + options + '</select>' +
            '<button type="button" class="softButton accent" id="contrAjout">Ajouter</button>' +
            '</div>' +
            '<p class="contrErreur" id="contrErreur" hidden></p>' +
            '<ul class="contrListe" id="contrListe"></ul>',
            'Fermer', { large: true }
        ).addEventListener('click', fermerModale);
        if ($('contrB').options.length > 1) $('contrB').selectedIndex = 1;

        function afficherListe() {
            $('contrListe').innerHTML = state.plan.contraintes.map(function (c, i) {
                var a = trouverEleve(c.a), b = trouverEleve(c.b);
                return '<li class="contr ' + c.type + '"><span>' + (c.type === 'separer' ? '🚫 ' : '🤝 ') + '<strong>' + escapeHtml(nomComplet(a)) + '</strong> ' +
                    (c.type === 'separer' ? 'à séparer de' : 'avec') + ' <strong>' + escapeHtml(nomComplet(b)) + '</strong></span>' +
                    '<button type="button" class="btnSupprimer" data-i="' + i + '" aria-label="Supprimer cette contrainte">✕</button></li>';
            }).join('') || '<li class="contrVide">Aucune contrainte pour l\'instant.</li>';
            rafraichirPlan();   // met à jour le compteur du bouton, derrière la fenêtre
        }
        $('contrAjout').addEventListener('click', function () {
            var a = $('contrA').value, b = $('contrB').value, type = $('contrType').value;
            $('contrErreur').hidden = a !== b;
            $('contrErreur').textContent = 'Choisissez deux élèves différents.';
            if (a === b) return;
            memoriserPlan();
            state.plan.contraintes = state.plan.contraintes.filter(function (c) { return !((c.a === a && c.b === b) || (c.a === b && c.b === a)); });
            state.plan.contraintes.push({ a: a, b: b, type: type });
            sauvegarder();
            afficherListe();
        });
        $('contrListe').addEventListener('click', function (e) {
            var btn = e.target.closest('.btnSupprimer');
            if (!btn) return;
            memoriserPlan();
            state.plan.contraintes.splice(parseInt(btn.dataset.i, 10), 1);
            sauvegarder();
            afficherListe();
        });
        afficherListe();
    }

    // ----- Impression / PDF et image PNG -----

    function ouvrirExportPlan() {
        if (!state.plan.tables.length) {
            planMessage = 'Choisissez d\'abord une disposition de salle.';
            rafraichirPlan();
            return;
        }
        var o = state.plan.export;
        var radio = function (nom, valeur, coche, texte) {
            return '<label class="checkLabel"><input type="radio" name="' + nom + '" value="' + valeur + '"' + (coche ? ' checked' : '') + '> ' + texte + '</label>';
        };
        var btn = ouvrirModale(
            '<h3>🖨️ Imprimer ou exporter le plan</h3>' +
            '<div class="exportPlan">' +
            '<fieldset><legend>Contenu</legend>' +
            radio('expContenu', 'rempli', !o.vide, 'Plan rempli, avec les prénoms') +
            radio('expContenu', 'vide', o.vide, 'Plan vide : tables seules, à compléter à la main') +
            '<label class="checkLabel sousOption"><input type="checkbox" id="expReperes"' + (o.reperes ? ' checked' : '') + (o.vide ? ' disabled' : '') + '> Afficher les repères AESH / PAI</label>' +
            '</fieldset>' +
            '<fieldset><legend>Orientation</legend>' +
            radio('expVue', 'enseignant', !o.vueEleves, 'Vue enseignant (tableau en haut)') +
            radio('expVue', 'eleves', o.vueEleves, 'Vue élèves (tableau en bas)') +
            '</fieldset>' +
            '<label class="exportTitre">Titre<input type="text" id="expTitre" value="' + escapeHtml(o.titre) + '"></label>' +
            '<p class="reglageAide">PDF : choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression.</p>' +
            '</div>',
            '🖨️ Imprimer / PDF', { libelleAnnuler: 'Annuler' });
        var png = document.createElement('button');
        png.type = 'button';
        png.className = 'btnAnnuler';
        png.textContent = '🖼️ Image PNG';
        btn.parentNode.insertBefore(png, btn);

        modalRoot.querySelectorAll('input[name="expContenu"]').forEach(function (r) {
            r.addEventListener('change', function () { $('expReperes').disabled = r.value === 'vide' && r.checked; });
        });
        function lireOptions() {
            state.plan.export = {
                vide: modalRoot.querySelector('input[name="expContenu"]:checked').value === 'vide',
                reperes: $('expReperes').checked,
                vueEleves: modalRoot.querySelector('input[name="expVue"]:checked').value === 'eleves',
                titre: $('expTitre').value.trim() || 'Plan de classe'
            };
            sauvegarder();
            fermerModale();
        }
        btn.addEventListener('click', function () { lireOptions(); lancerImpressionSections(['plan']); });
        png.addEventListener('click', function () { lireOptions(); exporterPlanPNG(state.plan.export); });
    }

    // Redessine le plan dans une image haute définition (sans bibliothèque externe) et la télécharge.
    function exporterPlanPNG(o) {
        var dessiner = function () {
            var p = state.plan, W = PLAN_LARGEUR, H = p.hauteur, M = 24, ENTETE = 56, ECHELLE = 2;
            var canvas = document.createElement('canvas');
            canvas.width = (W + 2 * M) * ECHELLE;
            canvas.height = (H + 2 * M + ENTETE) * ECHELLE;
            var ctx = canvas.getContext('2d');
            ctx.scale(ECHELLE, ECHELLE);
            var police = function (taille) { return '700 ' + taille + 'px Marianne, system-ui, sans-serif'; };
            function rect(x, y, w, h, r, fond, trait) {
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
                if (fond) { ctx.fillStyle = fond; ctx.fill(); }
                if (trait) { ctx.strokeStyle = trait; ctx.lineWidth = 1.2; ctx.stroke(); }
            }
            // Texte centré sur 1 ou 2 lignes (coupure aux espaces et aux traits d'union), réduit jusqu'à tenir.
            function ecrire(texte, x, y, w, h, tailleMax, couleur) {
                var morceaux = [];
                texte.split(/\s+/).forEach(function (mot) {
                    var parts = mot.split('-');
                    parts.forEach(function (m, i) { morceaux.push({ t: m + (i < parts.length - 1 ? '-' : ''), espace: i === parts.length - 1 }); });
                });
                var lignes, taille;
                for (taille = tailleMax; taille >= 8; taille--) {
                    ctx.font = police(taille);
                    lignes = [''];
                    morceaux.forEach(function (m, i) {
                        var courante = lignes[lignes.length - 1];
                        var essai = courante + (courante && morceaux[i - 1].espace ? ' ' : '') + m.t;
                        if (!courante || ctx.measureText(essai).width <= w - 6) lignes[lignes.length - 1] = essai;
                        else lignes.push(m.t);
                    });
                    if (lignes.length <= 2 && lignes.length * taille * 1.15 <= h - 2 && lignes.every(function (l) { return ctx.measureText(l).width <= w - 6; })) break;
                }
                lignes = lignes.slice(0, 2);
                ctx.fillStyle = couleur;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                lignes.forEach(function (l, i) {
                    ctx.fillText(l, x + w / 2, y + h / 2 + (i - (lignes.length - 1) / 2) * taille * 1.15, w - 4);
                });
            }

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, W + 2 * M, H + 2 * M + ENTETE);
            ctx.font = police(26);
            ctx.fillStyle = '#000091';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(o.titre || 'Plan de classe', M, M + 28);
            ctx.font = police(15);
            ctx.fillStyle = '#1e1e2f';
            ctx.textAlign = 'right';
            ctx.fillText(formatDateLongue(aujourdHuiISO()), M + W, M + 28);
            ctx.fillStyle = '#000091';
            ctx.fillRect(M, M + 40, W, 3);
            ctx.translate(M, M + ENTETE);

            rect(0, 0, W, H, 12, '#fafafc', '#9a9ab0');
            var hTableau = 34, yTableau = o.vueEleves ? H - 9 - hTableau : 9;
            rect(W * 0.32, yTableau, W * 0.36, hTableau, 6, '#2f4f3a');
            ecrire('T A B L E A U', W * 0.32, yTableau, W * 0.36, hTableau, 15, '#e8f3ea');

            var couleurs = p.couleurs.actif && !o.vide;
            p.tables.forEach(function (t) {
                var x = o.vueEleves ? W - t.x - t.w : t.x, y = o.vueEleves ? H - t.y - t.h : t.y;
                if (t.type !== 'table') {
                    rect(x, y, t.w, t.h, 6, t.type === 'bureau' ? '#9aa7b8' : '#dfe3ea', '#6c7a8d');
                    ecrire(nomMeuble(t), x, y, t.w, t.h, 14, '#1e1e2f');
                    return;
                }
                rect(x, y, t.w, t.h, 7, '#d9b98a', '#a88652');
                var vertical = t.h > t.w, marge = 3, ecart = 2.5, n = t.places;
                var sw = vertical ? t.w - 2 * marge : (t.w - 2 * marge - ecart * (n - 1)) / n;
                var sh = vertical ? (t.h - 2 * marge - ecart * (n - 1)) / n : t.h - 2 * marge;
                t.eleves.forEach(function (id, i) {
                    var rang = o.vueEleves ? n - 1 - i : i;   // plan retourné : l'ordre des places aussi
                    var sx = x + marge + (vertical ? 0 : rang * (sw + ecart)), sy = y + marge + (vertical ? rang * (sh + ecart) : 0);
                    var el = id && !o.vide ? trouverEleve(id) : null;
                    rect(sx, sy, sw, sh, 5, el && couleurs ? p.couleurs[el.genre === 'M' ? 'M' : 'F'] : '#fffdf8', '#c9ad80');
                    if (!el) return;
                    var reperes = o.reperes ? [el.aesh ? 'AESH' : '', el.pai ? 'PAI' : ''].filter(Boolean).join(' · ') : '';
                    ecrire(nomPlan(el), sx, sy, sw, reperes ? sh - 12 : sh, 16, '#1e1e2f');
                    if (reperes) {
                        ctx.font = police(10);
                        ctx.fillStyle = '#a94700';
                        ctx.fillText(reperes, sx + sw / 2, sy + sh - 8, sw - 4);
                    }
                });
            });

            canvas.toBlob(function (blob) {
                var url = URL.createObjectURL(blob), lien = document.createElement('a');
                lien.href = url;
                lien.download = 'plan-de-classe_' + aujourdHuiISO() + '.png';
                document.body.appendChild(lien);
                lien.click();
                lien.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            }, 'image/png');
        };
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(dessiner); else dessiner();
    }

    document.addEventListener('keydown', function (e) {
        if (state.activeTab !== 'plan' || modalRoot.innerHTML) return;
        if (e.key === 'Escape' && planSelection) { planSelection = null; rafraichirPlan(); }
        var saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !saisie) { e.preventDefault(); annulerPlan(); }
    });

    // ---------- CSV export / import ----------
    // Le mapping d'en-têtes ci-dessous est volontairement flexible (alias + comparaison
    // insensible aux accents/majuscules) afin de pouvoir accueillir facilement, plus tard,
    // un format d'export différent (par ex. ONDE) sans réécrire le parseur.

    // Chaque champ liste ses alias par ordre de priorité : on cherche l'alias le plus
    // spécifique dans TOUTES les colonnes avant de retomber sur un alias plus large. Cela
    // évite par exemple qu'un intitulé de colonne « Nom » (nom de famille) ne soit pris pour
    // le prénom, ou qu'une colonne « ... de la classe » ne soit prise pour le niveau.
    var ALIAS_CHAMPS = {
        nom: ['nom'],
        prenom: ['prenom'],
        genre: ['sexe', 'genre'],
        dateNaissance: ['naissance', 'ddn'],
        niveau: ['niveau', 'classe'],
        pai: ['pai'],
        aesh: ['aesh']
    };

    function exporterCSV() {
        if (state.eleves.length === 0) return;
        var entetes = ['Nom', 'Prenom', 'Genre', 'DateNaissance', 'Niveau', 'PAI', 'AESH'];
        var lignes = [entetes.join(';')];
        state.eleves.forEach(function (el) {
            lignes.push([
                el.nom || '', el.prenom, el.genre, formatDateFR(el.dateNaissance), el.niveau,
                el.pai ? 'Oui' : 'Non', el.aesh ? 'Oui' : 'Non'
            ].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
        });
        telecharger('﻿' + lignes.join('\n'), 'text/csv;charset=utf-8;', 'csv');
    }

    function parserLigneCSV(ligne, delimiteur) {
        var champs = [];
        var courant = '';
        var dansGuillemets = false;
        for (var i = 0; i < ligne.length; i++) {
            var c = ligne[i];
            if (dansGuillemets) {
                if (c === '"') {
                    if (ligne[i + 1] === '"') { courant += '"'; i++; }
                    else dansGuillemets = false;
                } else courant += c;
            } else if (c === '"') {
                dansGuillemets = true;
            } else if (c === delimiteur) {
                champs.push(courant);
                courant = '';
            } else {
                courant += c;
            }
        }
        champs.push(courant);
        return champs;
    }

    function importerCSV(texte) {
        var lignes = texte.split(/\r\n|\n/).filter(function (l) { return l.trim() !== ''; });
        if (lignes.length < 2) return 0;
        var delimiteur = (lignes[0].split(';').length >= lignes[0].split(',').length) ? ';' : ',';
        var entetes = parserLigneCSV(lignes[0], delimiteur).map(normaliserTexte);

        function indexPour(champ) {
            var alias = ALIAS_CHAMPS[champ];
            var i, j;
            // 1) correspondance exacte, alias par alias (évite par ex. que "nom" ne matche
            //    dans "prenom" quand aucune colonne "Nom" n'existe réellement)
            for (j = 0; j < alias.length; j++) {
                for (i = 0; i < entetes.length; i++) {
                    if (entetes[i] === alias[j]) return i;
                }
            }
            // 2) repli : correspondance partielle, alias par alias sur toutes les colonnes
            for (j = 0; j < alias.length; j++) {
                for (i = 0; i < entetes.length; i++) {
                    if (entetes[i].indexOf(alias[j]) !== -1) return i;
                }
            }
            return -1;
        }

        var idx = {};
        Object.keys(ALIAS_CHAMPS).forEach(function (champ) { idx[champ] = indexPour(champ); });
        if (idx.prenom === -1) return 0;

        function oui(v) { return /^(oui|o|x|1|true|vrai)$/i.test((v || '').trim()); }

        var ajouts = 0;
        for (var i = 1; i < lignes.length; i++) {
            var champs = parserLigneCSV(lignes[i], delimiteur);
            var prenom = (champs[idx.prenom] || '').trim();
            if (!prenom) continue;

            var genreBrut = idx.genre !== -1 ? (champs[idx.genre] || '').trim().toUpperCase() : 'F';
            var genre = (genreBrut.indexOf('M') === 0 || genreBrut.indexOf('G') === 0) ? 'M' : 'F';

            state.eleves.push(nouvelEleve({
                nom: idx.nom !== -1 ? (champs[idx.nom] || '').trim() : '',
                prenom: prenom,
                dateNaissance: idx.dateNaissance !== -1 ? normaliserDateISO(champs[idx.dateNaissance]) : '',
                genre: genre,
                niveau: idx.niveau !== -1 && champs[idx.niveau] ? champs[idx.niveau].trim() : 'CP',
                pai: idx.pai !== -1 ? oui(champs[idx.pai]) : false,
                aesh: idx.aesh !== -1 ? oui(champs[idx.aesh]) : false
            }));
            ajouts++;
        }
        return ajouts;
    }

    $('btnExportCsv').addEventListener('click', exporterCSV);

    $('btnImportCsv').addEventListener('click', function () { $('fileImportCsv').click(); });
    $('fileImportCsv').addEventListener('change', function (e) {
        var fichier = e.target.files[0];
        if (!fichier) return;
        var lecteur = new FileReader();
        lecteur.onload = function (evt) {
            // Un CSV enregistré par Excel est souvent en Windows-1252 : on le relit ainsi si l'UTF-8 échoue (accents).
            var texte = new TextDecoder('utf-8').decode(evt.target.result);
            if (texte.indexOf('\uFFFD') !== -1) texte = new TextDecoder('windows-1252').decode(evt.target.result);
            var ajouts = importerCSV(texte);
            $('fileImportCsv').value = '';
            if (ajouts > 0) { sauvegarder(); render(); }
        };
        lecteur.readAsArrayBuffer(fichier);
    });

    // ---------- Export / import JSON (sauvegarde complète, sans perte) ----------
    // Contrairement au CSV (pensé pour l'interopérabilité avec Excel/ONDE, et donc limité
    // à quelques colonnes), le JSON conserve l'intégralité des données de l'outil : idéal
    // pour reprendre le travail plus tard (ex. sur un autre appareil) sans rien perdre.

    function exporterJSON() {
        var donnees = {
            format: 'ma-classe-en-boite-apps1d76',
            version: 1,
            exporteLe: new Date().toISOString(),
            eleves: state.eleves,
            nbGroupes: state.nbGroupes,
            nomsGroupes: state.nomsGroupes,
            couleursGroupes: state.couleursGroupes,
            notes: state.notes,
            apcSeances: state.apcSeances,
            pointage: state.pointage,
            plan: state.plan
        };
        telecharger(JSON.stringify(donnees, null, 2), 'application/json;charset=utf-8;', 'json');
    }

    function chargerDonneesJSON(donnees) {
        state.eleves = Array.isArray(donnees.eleves) ? donnees.eleves : [];
        state.eleves.forEach(function (el) {
            if (!el.id) el.id = uid();
            if (!el.garderieJours) el.garderieJours = nouveauGarderieJours();
        });
        state.nbGroupes = donnees.nbGroupes || 4;
        state.nomsGroupes = donnees.nomsGroupes || [];
        state.couleursGroupes = donnees.couleursGroupes || [];
        state.notes = normaliserNotes(donnees.notes || EXEMPLES_NOTES.slice());
        state.apcSeances = donnees.apcSeances || [];
        state.pointage = Object.assign({}, POINTAGE_DEFAUT, donnees.pointage);
        state.plan = normaliserPlan(donnees.plan);
        pilePlan = [];
        pointageSelection = null;
        sauvegarder();
        render();
    }

    $('btnExportJson').addEventListener('click', exporterJSON);

    $('btnImportJson').addEventListener('click', function () { $('fileImportJson').click(); });
    $('fileImportJson').addEventListener('change', function (e) {
        var fichier = e.target.files[0];
        if (!fichier) return;
        var lecteur = new FileReader();
        lecteur.onload = function (evt) {
            $('fileImportJson').value = '';
            var donnees = null;
            try { donnees = JSON.parse(evt.target.result); } catch (err) {}
            if (!donnees || !Array.isArray(donnees.eleves)) {
                showConfirm('Fichier invalide', 'Ce fichier n\'est pas un export JSON valide de cet outil.', function () {}, { libelleConfirmer: 'OK', bleu: true });
                return;
            }
            showConfirm('Importer ce fichier', 'Cela remplacera la classe actuellement chargée (' + state.eleves.length + ' élève(s)) par celle du fichier (' + donnees.eleves.length + ' élève(s)). Continuer ?', function () {
                chargerDonneesJSON(donnees);
            }, { libelleConfirmer: 'Importer', bleu: true });
        };
        lecteur.readAsText(fichier, 'UTF-8');
    });

    // ---------- Menus déroulants (haut de page) ----------
    // Repliés par défaut, ils ne s'ouvrent que sur un clic direct sur leur bouton, et se
    // referment au clic ailleurs (ou sur l'un de leurs propres boutons d'action).

    function fermerMenus() {
        document.querySelectorAll('.dropdownMenu').forEach(function (m) { m.hidden = true; });
        document.querySelectorAll('.dropdown > .softButton').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }

    function initMenuDeroulant(idBouton, idMenu) {
        var bouton = $(idBouton);
        var menu = $(idMenu);
        bouton.addEventListener('click', function (e) {
            e.stopPropagation();
            var etaitOuvert = !menu.hidden;
            fermerMenus();
            menu.hidden = etaitOuvert;
            bouton.setAttribute('aria-expanded', etaitOuvert ? 'false' : 'true');
        });
    }
    initMenuDeroulant('btnMenuCsv', 'menuCsv');
    initMenuDeroulant('btnMenuJson', 'menuJson');
    // Un clic ailleurs referme menus déroulants et popovers (couleurs de groupe, emojis).
    document.addEventListener('click', function () {
        fermerMenus();
        document.querySelectorAll('.popoverCouleurs, .popoverEmojis').forEach(function (p) { p.remove(); });
    });

    // ---------- Impression (options par onglet) ----------

    var SECTIONS_IMPRESSION = [
        { cle: 'liste', label: 'Liste des élèves', rendu: renderListe },
        { cle: 'pyramide', label: 'Pyramide des âges', rendu: renderPyramide },
        { cle: 'anniversaires', label: 'Anniversaires', rendu: renderAnniversaires },
        { cle: 'groupes', label: 'Groupes', rendu: renderGroupes },
        { cle: 'cantine', label: 'Cantine / Garderie', rendu: renderCantine },
        { cle: 'autres', label: 'Informations (pense-bête)', rendu: renderAutres },
        { cle: 'apc', label: 'Suivi APC', rendu: renderApc },
        { cle: 'pointage', label: 'Feuille de pointage', rendu: renderPointage },
        { cle: 'plan', label: 'Plan de classe', rendu: renderPlanClasse }
    ];

    function showPrintOptions() {
        var options = SECTIONS_IMPRESSION.map(function (s) {
            return '<label class="checkLabel" style="display:flex; margin-bottom:8px;"><input type="checkbox" class="chkSectionImpression" value="' + s.cle + '"' + (s.cle === state.activeTab ? ' checked' : '') + '> ' + escapeHtml(s.label) + '</label>';
        }).join('');
        ouvrirModale(
            '<h3>🖨️ Que voulez-vous imprimer ?</h3>' +
            '<p>Choisissez une ou plusieurs sections à inclure (chacune sur sa propre page).</p>' +
            '<div class="optionsImpression">' + options + '</div>',
            'Imprimer', { libelleAnnuler: 'Annuler' }
        ).addEventListener('click', function () {
            var choisies = [...modalRoot.querySelectorAll('.chkSectionImpression:checked')].map(function (cb) { return cb.value; });
            fermerModale();
            if (choisies.length) lancerImpressionSections(choisies);
        });
    }

    function lancerImpressionSections(cles) {
        function retirerMarquage() {
            document.querySelectorAll('.tabPanel').forEach(function (p) { p.classList.remove('a-imprimer', 'sautDePage'); });
        }
        SECTIONS_IMPRESSION.forEach(function (s) { if (cles.indexOf(s.cle) !== -1) s.rendu(); });
        document.body.classList.add('impressionCiblee');

        retirerMarquage();
        cles.forEach(function (cle, i) {
            var panel = $('panel-' + cle);
            if (!panel) return;
            panel.classList.add('a-imprimer');
            if (i > 0) panel.classList.add('sautDePage');
        });

        function nettoyer() {
            retirerMarquage();
            document.body.classList.remove('impressionCiblee');
            render();
            window.removeEventListener('afterprint', nettoyer);
        }
        window.addEventListener('afterprint', nettoyer);
        setTimeout(function () { window.print(); }, 30);
    }

    $('btnPrint').addEventListener('click', showPrintOptions);

    // ---------- Aide / à propos ----------

    function showAide() {
        ouvrirModale(
            '    <h3>🎓 Aide — Ma Classe en Boîte</h3>' +
            '    <div class="corpsAide">' +
            '      <h4>📋 Liste</h4><p>Ajoutez vos élèves via le formulaire en haut de page. Modifiez n\'importe quel champ directement dans le tableau, triez en cliquant sur l\'en-tête d\'une colonne.</p>' +
            '      <h4>📊 Pyramide &amp; 🎂 Anniversaires</h4><p>Générées automatiquement à partir des dates de naissance de la liste, rien à saisir.</p>' +
            '      <h4>👥 Groupes</h4><p>Régénérez des groupes équilibrés en un clic, ou glissez-déposez les élèves à la main. Renommez un groupe (icône crayon) et changez sa couleur (pastille), ajoutez ou supprimez des groupes librement.</p>' +
            '      <h4>🍽️ Cantine / Garderie</h4><p>Cochez cantine et/ou garderie par élève ; le régime alimentaire, les jours de garderie, l\'allergie et une remarque libre apparaissent alors. Si AESH est coché pour un élève, ses horaires de présence par demi-journée s\'affichent aussi ici.</p>' +
            '      <h4>📝 Autres</h4><p>Un pense-bête libre pour vos informations pratiques, avec un emoji au choix par ligne pour vous repérer.</p>' +
            '      <h4>🎯 Suivi APC</h4><p>Enregistrez chaque séance avec sa date, son objectif et les élèves présents.</p>' +
            '      <h4>🖨️ Pointage / exportation PDF</h4><p>Choisissez le type de liste dans les sous-onglets (liste générale à colonnes vides, liste rapide en deux exemplaires, cantine, garderie matin et soir, APC, sortie / appel, ou liste personnalisée) et la date : la feuille se pré-remplit avec les élèves concernés. La liste personnalisée permet de cocher les colonnes à inclure (N°, case Présent, niveau, naissance, genre, cantine, garderie du jour, allergie / PAI, AESH, remarque), d\'imprimer en deux exemplaires et d\'ajouter une ligne vierge pour titrer les colonnes. Pour les listes générale, rapide et personnalisée, choisissez le nombre de colonnes à remplir et l\'orientation (portrait ou paysage). Réglez l\'affichage des noms (avec ou sans nom de famille), l\'ordre alphabétique (nom ou prénom) et la séparation par niveau. Ajustez la sélection si besoin, puis cliquez sur « Imprimer / enregistrer en PDF » (choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression).</p>' +
            '      <h4>🗺️ Plan de classe</h4><p>Un mode d\'emploi repliable est affiché en haut de l\'onglet. <strong>Étape 1 — Aménager la salle</strong> : choisissez une disposition type, calculée pour le nombre d\'élèves. Déplacez les tables à la souris ou au doigt ; cliquez sur une table pour la redimensionner (poignée en bas à droite, ou Maj + flèches), changer son nombre de places (1 à 4), la pivoter ou la supprimer. « + Mobilier » ajoute bureau, porte, fenêtre, armoire ou un élément à nommer. <strong>Étape 2 — Placer les élèves</strong> : glissez un prénom de la liste sur une place (au doigt : appui long puis glisser), ou touchez l\'élève puis la place. Déposer sur un élève assis les échange ; × le remet dans la liste ; 📌 l\'épingle pour que le tirage ne le déplace pas. « Placer les élèves restants » complète les places libres, « Nouveau tirage » remélange tout sauf les élèves épinglés (options : alternance filles / garçons, remplissage devant d\'abord ou réparti). « Contraintes » : paires d\'élèves à séparer ou à mettre à la même table, respectées au mieux par le tirage. « 🎨 Couleurs » personnalise les couleurs filles / garçons. « Imprimer / exporter » : plan vide ou rempli, vue enseignant ou élèves, en PDF (fenêtre d\'impression) ou en image PNG. « ↶ Annuler » (Ctrl+Z) revient en arrière à tout moment.</p>' +
            '      <h4>Import / export</h4>' +
            '      <ul>' +
            '        <li><strong>CSV</strong> : compatible avec un export ONDE (« Liste simple des élèves par classe ») pour importer une classe, ou avec Excel pour exporter.</li>' +
            '        <li><strong>JSON</strong> : sauvegarde complète et fidèle de tout l\'outil (élèves, groupes, notes, APC…), pour reprendre le travail plus tard, y compris sur un autre appareil.</li>' +
            '      </ul>' +
            '      <h4>🖨️ Imprimer / PDF</h4><p>Le bouton « Exporter cet onglet en PDF » (au-dessus de chaque onglet) imprime l\'onglet affiché : choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression. Le bouton « Imprimer » en haut de page permet de regrouper plusieurs sections, chacune sur une nouvelle page.</p>' +
            '      <p class="creditAide">Outil développé par <strong>Etienne Liaudet</strong> — Mission numérique 76 (DSDEN de la Seine-Maritime).</p>' +
            '    </div>',
            'Fermer', { large: true }
        ).addEventListener('click', fermerModale);
    }

    $('btnAide').addEventListener('click', showAide);

    // ---------- Effacement ----------

    $('btnClearAll').addEventListener('click', function () {
        if (state.eleves.length === 0) return;
        showConfirm('Tout effacer', 'Voulez-vous vraiment supprimer tous les élèves et réinitialiser les groupes ? Le pense-bête (onglet Autres) est conservé.', function () {
            state.eleves = [];
            state.nbGroupes = 4;
            state.nomsGroupes = [];
            state.couleursGroupes = [];
            sauvegarder();
            render();
        });
    });

    // ---------- Démarrage ----------

    charger();
    render();
})();
