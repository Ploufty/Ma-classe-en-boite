(function () {
    'use strict';

    var STORAGE_ELEVES = 'gestionClasse_eleves';
    var STORAGE_REGLAGES = 'gestionClasse_reglages';
    var NIVEAUX_ORDRE = { 'PS': 1, 'MS': 2, 'GS': 3, 'CP': 4, 'CE1': 5, 'CE2': 6, 'CM1': 7, 'CM2': 8 };
    var NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    var NOMS_MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
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

    var POINTAGE_DEFAUT = { type: 'cantine', titre: '', lignesVides: 2 };
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
        pointage: Object.assign({}, POINTAGE_DEFAUT)
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
                pointage: state.pointage
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
            }
        } catch (e) {}
        // Première utilisation : on amorce le pense-bête avec des exemples plutôt que de le laisser vide.
        state.notes = normaliserNotes(state.notes || EXEMPLES_NOTES.slice());
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
        render();
    }

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
                '<td class="no-print"><button type="button" class="btnSupprimer" data-id="' + el.id + '" title="Supprimer">✕</button></td>' +
                '</tr>';
        }).join('');

        panel.innerHTML =
            '<div class="panelHeader"><h2 style="margin:0;">Liste de la classe</h2><span class="countBadge">' + state.eleves.length + (state.eleves.length > 1 ? ' élèves' : ' élève') + '</span></div>' +
            '<div class="tableWrap"><table class="listeTable"><thead><tr>' +
            '<th class="' + classeTri('nom') + '" data-sort="nom">Nom</th>' +
            '<th class="' + classeTri('prenom') + '" data-sort="prenom">Prénom</th>' +
            '<th class="' + classeTri('genre') + '" data-sort="genre">Genre</th>' +
            '<th class="' + classeTri('dateNaissance') + '" data-sort="dateNaissance">Naissance</th>' +
            '<th class="' + classeTri('niveau') + '" data-sort="niveau">Niveau</th>' +
            '<th>PAI</th><th>AESH</th><th class="no-print">Actions</th>' +
            '</tr></thead><tbody>' + lignes + '</tbody></table></div>';

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
                (dansGroupe ? '<button type="button" class="btnRetirer no-print" data-id="' + el.id + '" title="Retirer du groupe">✕</button>' : '') +
                '</li>';
        }

        var htmlNonAssignes = '<div class="zoneGroupe nonAssignes" data-groupe="0">' +
            '<div class="zoneGroupeTitre"><span class="nomGroupe">Élèves non assignés</span><span class="compte">' + nonAssignes.length + '</span></div>' +
            '<ul style="list-style:none; margin:0; padding:0;">' + (nonAssignes.map(function (e) { return etiquette(e, false); }).join('') || '<li class="annivVide">Aucun</li>') + '</ul>' +
            '</div>';

        var htmlGroupes = groupes.map(function (liste, i) {
            var couleur = couleurGroupe(i);
            return '<div class="zoneGroupe" data-groupe="' + (i + 1) + '">' +
                '<div class="zoneGroupeTitre">' +
                '<button type="button" class="pastilleCouleurGroupe no-print" data-groupe-index="' + i + '" style="background:' + couleur + ';" title="Changer la couleur du groupe"></button>' +
                '<span class="nomGroupe">' + escapeHtml(nomGroupe(i)) + '</span>' +
                '<span class="compte">' + liste.length + '</span>' +
                '<button type="button" class="btnRenommerGroupe no-print" data-groupe-index="' + i + '" title="Renommer le groupe">✎</button>' +
                (nb > 1 ? '<button type="button" class="btnSupprimerGroupe no-print" data-groupe-index="' + i + '" title="Supprimer ce groupe">✕</button>' : '') +
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
                    return '<button type="button" style="background:' + c + ';" data-couleur="' + c + '"></button>';
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

        panel.innerHTML = '<h2 style="margin-top:0;">Cantine et garderie</h2><div class="grilleCantine">' + cartes + '</div>';

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
                '<button type="button" class="btnEmojiNote no-print" data-index="' + i + '" title="Choisir un emoji">' + (note.emoji || '➕') + '</button>' +
                '<input type="text" class="editInput" data-index="' + i + '" data-champ="texte" value="' + escapeHtml(note.texte || '') + '" placeholder="Ex : Code photocopieuse : 1234">' +
                '<button type="button" class="btnSupprimer" data-index="' + i + '" title="Supprimer cette ligne">✕</button>' +
                '</div>';
        }).join('') || '<div class="notesVide">Aucune ligne pour l\'instant. Ajoutez-en une ci-dessous.</div>';

        panel.innerHTML =
            '<h2 style="margin-top:0;">📝 Informations importantes de la classe</h2>' +
            '<p class="autresIntro">Notez ici vos codes ou informations diverses de la classe (une ligne par information, avec un emoji au choix pour vous repérer), à consulter ou imprimer à tout moment.</p>' +
            '<div class="boiteNotes">' + lignes + '</div>' +
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
                '<button type="button" class="btnSupprimer no-print" data-id="' + s.id + '" title="Supprimer cette séance">✕</button></div>' +
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

    // ---------- Vue Pointage (PDF) ----------
    // Feuille de pointage pour une date précise : la sélection des élèves est pré-remplie depuis
    // les onglets Cantine / Garderie / Suivi APC, ajustable à la main, puis imprimée (ou enregistrée
    // en PDF depuis la fenêtre d'impression du navigateur).

    var TYPES_POINTAGE = {
        cantine: { label: '🍽️ Cantine', titre: 'Pointage cantine' },
        garderieMatin: { label: '🌅 Garderie du matin', titre: 'Pointage garderie du matin' },
        garderieSoir: { label: '🌇 Garderie du soir', titre: 'Pointage garderie du soir' },
        apc: { label: '🎯 APC', titre: 'Pointage APC' },
        sortie: { label: '🚌 Sortie / appel', titre: 'Liste d\'appel' }
    };
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

    function elevesAlphabetique() {
        return state.eleves.slice().sort(function (a, b) {
            return (a.nom || a.prenom).localeCompare(b.nom || b.prenom, 'fr', { sensitivity: 'base' }) ||
                a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' });
        });
    }

    // Élèves à inclure d'office selon le type de liste et la date.
    function preremplissagePointage(type, dateIso) {
        var ids = [], note = '', domaine = '';
        var jour = cleJourSemaine(dateIso);
        if (type === 'cantine') {
            ids = state.eleves.filter(function (el) { return el.cantine; }).map(function (el) { return el.id; });
            if (!ids.length) note = 'Aucun élève n\'est inscrit à la cantine (onglet Cantine / Garderie) : cochez les élèves concernés.';
        } else if (type === 'garderieMatin' || type === 'garderieSoir') {
            var periode = type === 'garderieMatin' ? 'matin' : 'apresmidi';
            if (!jour) {
                note = 'Cette date tombe un week-end : aucune garderie prévue.';
            } else {
                ids = state.eleves.filter(function (el) {
                    return el.garderie && el.garderieJours && el.garderieJours[jour] && el.garderieJours[jour][periode];
                }).map(function (el) { return el.id; });
                if (!ids.length) note = 'Aucun élève inscrit à cette garderie ce jour-là (onglet Cantine / Garderie) : cochez les élèves concernés.';
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
        var eleve = { titre: 'Élève', classe: 'colNom', cellule: function (el) { return escapeHtml(nomComplet(el)); } };
        var vide = function (titre, classe) { return { titre: titre, classe: classe, cellule: function () { return ''; } }; };
        var remarque = { titre: 'Remarque', classe: 'colLarge', cellule: function (el) { return escapeHtml(el.remarque || ''); } };

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
        if (type === 'garderieMatin' || type === 'garderieSoir') {
            return [caseCoche, eleve, vide('Arrivée', 'colHeure'), vide('Départ', 'colHeure'), remarque];
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
        var type = TYPES_POINTAGE[p.type] ? p.type : 'cantine';
        var choisis = elevesAlphabetique().filter(function (el) { return pointageSelection.indexOf(el.id) !== -1; });
        var colonnes = colonnesPointage(type);

        var details = [];
        if (type === 'cantine') {
            var sansViande = choisis.filter(function (el) { return el.cantineSansViande; }).length;
            var sansPorc = choisis.filter(function (el) { return el.cantineSansPorc; }).length;
            if (sansViande) details.push(sansViande + ' sans viande');
            if (sansPorc) details.push(sansPorc + ' sans porc');
        }
        var domaine = preremplissagePointage(type, pointageDate).domaine;
        if (domaine) details.push('Domaine : ' + domaine);
        var sousTitre = choisis.length + (choisis.length > 1 ? ' élèves attendus' : ' élève attendu') + (details.length ? ' — ' + details.join(' — ') : '');

        var lignes = choisis.map(function (el) {
            return '<tr>' + colonnes.map(function (c) { return '<td class="' + c.classe + '">' + c.cellule(el) + '</td>'; }).join('') + '</tr>';
        });
        var nbVides = bornerLignesVides(p.lignesVides);
        for (var i = 0; i < nbVides; i++) {
            lignes.push('<tr>' + colonnes.map(function (c) {
                return '<td class="' + c.classe + '">' + (c.classe === 'colCase' ? '<span class="caseCoche"></span>' : '') + '</td>';
            }).join('') + '</tr>');
        }

        $('feuillePointage').innerHTML =
            '<div class="enteteFeuille"><h2>' + escapeHtml(p.titre.trim() || TYPES_POINTAGE[type].titre) + '</h2>' +
            '<div class="dateFeuille">' + escapeHtml(formatDateLongue(pointageDate)) + '</div></div>' +
            '<div class="sousTitreFeuille">' + escapeHtml(sousTitre) + '</div>' +
            '<table class="tablePointage"><thead><tr>' + colonnes.map(function (c) { return '<th class="' + c.classe + '">' + c.titre + '</th>'; }).join('') + '</tr></thead>' +
            '<tbody>' + lignes.join('') + '</tbody></table>' +
            '<div class="piedFeuille"><span>Présents : ……… / ' + choisis.length + '</span><span>Pointage effectué par : ……………………………</span></div>';
    }

    function majResumeSelectionPointage() {
        $('resumeSelectionPointage').textContent = 'Élèves inclus dans la feuille (' + pointageSelection.length + ' / ' + state.eleves.length + ')';
    }

    function rafraichirSelectionPointage() {
        $('checklistPointage').innerHTML = elevesAlphabetique().map(function (el) {
            return '<label class="checkLabel"><input type="checkbox" value="' + el.id + '"' + (pointageSelection.indexOf(el.id) !== -1 ? ' checked' : '') + '> ' + escapeHtml(nomComplet(el)) + '</label>';
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
        if (!TYPES_POINTAGE[p.type]) p.type = 'cantine';
        if (!pointageDate) pointageDate = aujourdHuiISO();

        var options = Object.keys(TYPES_POINTAGE).map(function (cle) {
            return '<option value="' + cle + '"' + (cle === p.type ? ' selected' : '') + '>' + TYPES_POINTAGE[cle].label + '</option>';
        }).join('');

        panel.innerHTML =
            '<div class="pointageOutils no-print">' +
            '<div class="formRow">' +
            '<div class="field"><label for="pointageType">Type de liste</label><select id="pointageType" class="selectNiveau">' + options + '</select></div>' +
            '<div class="field"><label for="pointageDate">Date</label><input type="date" id="pointageDate" value="' + pointageDate + '"></div>' +
            '<div class="field grow"><label for="pointageTitre">Titre (facultatif)</label><input type="text" id="pointageTitre" value="' + escapeHtml(p.titre) + '" placeholder="Ex : Sortie au musée"></div>' +
            '<div class="field"><label for="pointageVides">Lignes vides en plus</label><input type="number" id="pointageVides" min="0" max="' + MAX_LIGNES_VIDES + '" value="' + bornerLignesVides(p.lignesVides) + '"></div>' +
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

        $('pointageType').addEventListener('change', function () {
            state.pointage.type = this.value;
            state.pointage.titre = '';
            $('pointageTitre').value = '';
            sauvegarder();
            reinitialiserSelectionPointage();
        });
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

    function renderPlanClasse() {
        var panel = $('panel-plan');
        panel.innerHTML =
            '<div class="placeholderTab">' +
            '<span class="emptyIcon" aria-hidden="true">🗺️</span>' +
            '<h2>Plan de classe</h2>' +
            '<p>Cet onglet permettra bientôt de disposer les élèves de la liste sur un plan de classe (îlots, rangées…). En construction.</p>' +
            '</div>';
    }

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
            var ajouts = importerCSV(evt.target.result);
            $('fileImportCsv').value = '';
            if (ajouts > 0) { sauvegarder(); render(); }
        };
        lecteur.readAsText(fichier, 'UTF-8');
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
            pointage: state.pointage
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
        { cle: 'pointage', label: 'Feuille de pointage', rendu: renderPointage }
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
            '      <h4>🖨️ Pointage (PDF)</h4><p>Choisissez le type de liste (cantine, garderie du matin ou du soir, APC, sortie / appel) et la date : la feuille se pré-remplit avec les élèves concernés. Ajustez la sélection si besoin, puis cliquez sur « Imprimer / enregistrer en PDF » (choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression).</p>' +
            '      <h4>Import / export</h4>' +
            '      <ul>' +
            '        <li><strong>CSV</strong> : compatible avec un export ONDE (« Liste simple des élèves par classe ») pour importer une classe, ou avec Excel pour exporter.</li>' +
            '        <li><strong>JSON</strong> : sauvegarde complète et fidèle de tout l\'outil (élèves, groupes, notes, APC…), pour reprendre le travail plus tard, y compris sur un autre appareil.</li>' +
            '      </ul>' +
            '      <h4>🖨️ Imprimer</h4><p>Choisissez la ou les sections à imprimer : chacune démarre sur une nouvelle page.</p>' +
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
