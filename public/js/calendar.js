/**
 * Creator Family - espace calendrier.
 *
 * Navigation par barre latérale (sidebar) entre deux vues :
 *   - « Calendrier »   : prochaine conférence mise en avant, grille mensuelle,
 *                        liste des conférences à venir. Édition/suppression pour
 *                        les admins directement depuis les cartes.
 *   - « Rediffusions » : conférences passées (replay si disponible) + possibilité
 *                        pour chaque membre de laisser une évaluation.
 */

const screens = {
  login: document.getElementById('screen-login'),
  calendar: document.getElementById('screen-calendar'),
  loading: document.getElementById('screen-loading'),
};

const els = {
  // Layout / sidebar
  sidebar: document.getElementById('cal-sidebar'),
  scrim: document.getElementById('cal-scrim'),
  burger: document.getElementById('cal-burger'),
  navItems: Array.from(document.querySelectorAll('.cal-nav-item[data-view]')),
  views: {
    calendar: document.getElementById('view-calendar'),
    replays: document.getElementById('view-replays'),
  },
  sidebarAdmin: document.getElementById('sidebar-admin'),
  sidebarUsername: document.getElementById('sidebar-username'),
  replaysCount: document.getElementById('replays-count'),
  // Calendrier
  calMonth: document.getElementById('cal-month'),
  calGrid: document.getElementById('cal-grid'),
  calPrev: document.getElementById('cal-prev'),
  calNext: document.getElementById('cal-next'),
  calCount: document.getElementById('cal-count'),
  featured: document.getElementById('cal-featured'),
  eventsList: document.getElementById('events-list'),
  eventsTitle: document.getElementById('events-title'),
  // Rediffusions
  replaysList: document.getElementById('replays-list'),
  replaysSub: document.getElementById('replays-sub'),
  // Divers
  toast: document.getElementById('toast'),
  dayModal: document.getElementById('day-modal'),
  dayModalTitle: document.getElementById('day-modal-title'),
  dayModalBody: document.getElementById('day-modal-body'),
  dayModalClose: document.getElementById('day-modal-close'),
  // Ajout / édition conférence
  addBtn: document.getElementById('cal-add-btn'),
  quickAdd: document.getElementById('cal-quick-add'),
  eventModal: document.getElementById('event-modal'),
  eventModalTitle: document.getElementById('event-modal-title'),
  eventModalClose: document.getElementById('event-modal-close'),
  eventCancel: document.getElementById('event-cancel'),
  eventSubmit: document.getElementById('event-submit'),
  eventForm: document.getElementById('event-form'),
  eventId: document.getElementById('event-id'),
  eventTitle: document.getElementById('event-title'),
  eventDate: document.getElementById('event-date'),
  eventTime: document.getElementById('event-time'),
  eventHost: document.getElementById('event-host'),
  eventDesc: document.getElementById('event-desc'),
  eventReplay: document.getElementById('event-replay'),
  // Proposition
  proposeBtn: document.getElementById('cal-propose-btn'),
  proposeModal: document.getElementById('propose-modal'),
  proposeModalClose: document.getElementById('propose-modal-close'),
  proposeCancel: document.getElementById('propose-cancel'),
  proposeForm: document.getElementById('propose-form'),
  proposeSubject: document.getElementById('propose-subject'),
  proposeSector: document.getElementById('propose-sector'),
  proposeDetails: document.getElementById('propose-details'),
  // Questionnaire personnalisé
  surveyModal: document.getElementById('survey-modal'),
  surveyModalClose: document.getElementById('survey-modal-close'),
  surveyCancel: document.getElementById('survey-cancel'),
  surveyForm: document.getElementById('survey-form'),
  surveyEventId: document.getElementById('survey-event-id'),
  surveyEventTitle: document.getElementById('survey-event-title'),
  surveyQuestions: document.getElementById('survey-questions'),
  // Évaluation
  evalModal: document.getElementById('eval-modal'),
  evalModalClose: document.getElementById('eval-modal-close'),
  evalCancel: document.getElementById('eval-cancel'),
  evalForm: document.getElementById('eval-form'),
  evalEventId: document.getElementById('eval-event-id'),
  evalEventTitle: document.getElementById('eval-event-title'),
  evalStars: document.getElementById('eval-stars'),
  evalRating: document.getElementById('eval-rating'),
  evalPositive: document.getElementById('eval-positive'),
  evalImprove: document.getElementById('eval-improve'),
  // Confirmation
  confirmModal: document.getElementById('confirm-modal'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmText: document.getElementById('confirm-text'),
  confirmIcon: document.getElementById('confirm-icon'),
  confirmOk: document.getElementById('confirm-ok'),
  confirmCancel: document.getElementById('confirm-cancel'),
};

const state = {
  user: null,
  isAdmin: false,
  view: 'calendar',
  events: [], // conférences à venir, triées par date
  byDay: new Map(), // 'YYYY-MM-DD' -> [events]
  replays: null, // conférences passées (chargées à la demande)
  replaysLoading: false,
  viewYear: 0,
  viewMonth: 0,
};

const WEEKDAY_OFFSET = [6, 0, 1, 2, 3, 4, 5]; // getDay() dim=0 -> colonne (semaine L→D)
const MAX_CHIPS = 2; // conférences affichées dans une case avant le "+N"

const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtMonShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const fmtDateLong = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtPast = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Affiche un seul écran à la fois. */
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.hidden = key !== name;
  });
}

/** Petit toast (rouge par défaut, vert si `ok`). */
let toastTimer;
function showToast(message, ok = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('toast-ok', ok);
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => (els.toast.hidden = true), 300);
  }, 4000);
}

/** Échappe le HTML pour éviter toute injection. */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Première lettre en majuscule (les libellés FR d'Intl sont en minuscule). */
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Vérifie qu'une URL est http(s) (sinon on n'affiche pas de lien). */
function safeUrl(url) {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

/** Récupère l'utilisateur connecté (+ statut admin). */
async function fetchMe() {
  const res = await fetch('/auth/me');
  return res.json(); // { user, isAdmin, ... }
}

/** Appel API JSON. Lève une erreur avec le message serveur si non-2xx. */
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.unauthorized = true;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
  return data;
}

/** Recharge les conférences à venir depuis le serveur et rafraîchit l'affichage. */
async function reloadEvents() {
  const data = await api('GET', '/api/events');
  state.events = data.events || [];
  indexEvents();
  renderCalendarView();
}

/** Clé locale 'YYYY-MM-DD' d'une date. */
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Libellé relatif ("Aujourd'hui", "Demain", "Dans 3 jours"…) ou null si lointain. */
function relativeLabel(date) {
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  if (days <= 0) return { text: "Aujourd'hui", soon: true };
  if (days === 1) return { text: 'Demain', soon: true };
  if (days < 7) return { text: `Dans ${days} jours`, soon: days <= 2 };
  if (days < 14) return { text: 'Dans 1 semaine', soon: false };
  if (days < 31) return { text: `Dans ${Math.round(days / 7)} semaines`, soon: false };
  return null;
}

/** Mois abrégé sans point final ("juil"). */
function monShort(date) {
  return fmtMonShort.format(date).replace('.', '');
}

/** "Vendredi · 18:00" */
function dayTime(date) {
  return `${cap(fmtWeekday.format(date))} · ${fmtTime.format(date)}`;
}

/** "Vendredi 12 juillet · 18:00" */
function dateTimeLong(date) {
  return `${cap(fmtDateLong.format(date))} · ${fmtTime.format(date)}`;
}

/** Étoiles pleines/vides pour afficher une note (lecture seule). */
function starsHtml(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<span class="material-symbols-rounded${i <= rating ? ' filled' : ''}">star</span>`;
  }
  return `<span class="stars-view" aria-label="Note ${rating} sur 5">${out}</span>`;
}

/** Bouton "Être notifié" (rappel MP 30 min avant). */
function notifyBtnHtml(ev) {
  const on = ev.subscribed;
  return `
    <button class="notify-btn ${on ? 'on' : ''}" data-id="${escapeHtml(ev.id)}" type="button">
      <span class="material-symbols-rounded">${on ? 'notifications_active' : 'notifications'}</span>
      <span class="notify-label">${on ? 'Rappel activé' : 'Être notifié'}</span>
    </button>`;
}

/** Boutons d'administration (lien d'avis / modifier / supprimer) — admins. */
function adminControlsHtml(ev) {
  if (!state.isAdmin) return '';
  return `
    <div class="event-admin">
      <button class="icon-btn" data-admin="link" data-id="${escapeHtml(ev.id)}" type="button" title="Copier le lien d'avis (questionnaire)">
        <span class="material-symbols-rounded">link</span>
      </button>
      <button class="icon-btn" data-admin="edit" data-id="${escapeHtml(ev.id)}" type="button" title="Modifier">
        <span class="material-symbols-rounded">edit</span>
      </button>
      <button class="icon-btn danger" data-admin="delete" data-id="${escapeHtml(ev.id)}" type="button" title="Supprimer">
        <span class="material-symbols-rounded">delete</span>
      </button>
    </div>`;
}

/** URL directe vers le formulaire d'avis d'une conférence (questionnaire/évaluation). */
function feedbackLink(id) {
  return `${window.location.origin}/conferences?feedback=${encodeURIComponent(id)}`;
}

/** Copie un texte dans le presse-papiers (avec repli si l'API n'est pas dispo). */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* on tente le repli ci-dessous */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Copie le lien d'avis d'une conférence et prévient l'utilisateur. */
async function shareFeedbackLink(id) {
  const link = feedbackLink(id);
  const ok = await copyToClipboard(link);
  showToast(ok ? 'Lien d\'avis copié — envoie-le à la fin de la conférence. 🔗' : link, ok);
}

/** Bloc date (pastille jour + mois) partagé par la mise en avant et les cartes. */
function dayboxHtml(date) {
  return `
    <div class="daybox">
      <span class="daybox-day">${date.getDate()}</span>
      <span class="daybox-mon">${escapeHtml(monShort(date))}</span>
    </div>`;
}

/** Indexe les conférences par jour local. */
function indexEvents() {
  state.byDay = new Map();
  for (const ev of state.events) {
    const key = dayKey(new Date(ev.start));
    if (!state.byDay.has(key)) state.byDay.set(key, []);
    state.byDay.get(key).push(ev);
  }
}

/* =========================== Vue Calendrier =========================== */

/** Sous-titre : nombre de conférences. */
function renderCount() {
  const n = state.events.length;
  els.calCount.textContent =
    n === 0
      ? 'Aucune conférence programmée pour le moment.'
      : `${n} conférence${n > 1 ? 's' : ''} programmée${n > 1 ? 's' : ''}`;
}

/** Carte "prochaine conférence" (masquée s'il n'y a aucune conférence). */
function renderFeatured() {
  if (!state.events.length) {
    els.featured.hidden = true;
    return;
  }
  const ev = state.events[0];
  const d = new Date(ev.start);
  const rel = relativeLabel(d);
  els.featured.innerHTML = `
    <div class="featured-tag">
      <span class="material-symbols-rounded">bolt</span> Prochaine conférence
    </div>
    <div class="featured-row">
      ${dayboxHtml(d)}
      <div class="featured-main">
        <div class="featured-when">
          ${
            rel
              ? `<span class="when-pill ${rel.soon ? 'soon' : ''}">${escapeHtml(rel.text)}</span>`
              : ''
          }
          <span class="featured-datetime">
            <span class="material-symbols-rounded">schedule</span>${escapeHtml(dateTimeLong(d))}
          </span>
        </div>
        <h2 class="featured-title">${escapeHtml(ev.title)}</h2>
        ${
          ev.host
            ? `<div class="event-host"><span class="material-symbols-rounded">person</span>${escapeHtml(ev.host)}</div>`
            : ''
        }
        ${ev.description ? `<p class="event-desc">${escapeHtml(ev.description)}</p>` : ''}
        <div class="event-actions">
          ${notifyBtnHtml(ev)}
          ${adminControlsHtml(ev)}
        </div>
      </div>
    </div>`;
  els.featured.hidden = false;
}

/** Construit la grille du mois, avec les conférences DANS les cases. */
function renderGrid() {
  const { viewYear, viewMonth } = state;
  els.calMonth.textContent = cap(fmtMonth.format(new Date(viewYear, viewMonth, 1)));

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = WEEKDAY_OFFSET[firstDay.getDay()];
  const todayKey = dayKey(new Date());

  els.calGrid.innerHTML = '';

  for (let i = 0; i < leadingBlanks; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-cell-empty';
    els.calGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const key = dayKey(date);
    const dayEvents = state.byDay.get(key) || [];
    const hasEvents = dayEvents.length > 0;

    const cell = document.createElement(hasEvents ? 'button' : 'div');
    cell.className = 'cal-cell';
    if (key === todayKey) cell.classList.add('today');

    let chips = '';
    if (hasEvents) {
      cell.type = 'button';
      cell.classList.add('has-event');

      const shown = dayEvents.slice(0, MAX_CHIPS);
      const extra = dayEvents.length - shown.length;
      chips = `
        <span class="cal-events">
          ${shown
            .map(
              (e) =>
                `<span class="cal-chip" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`
            )
            .join('')}
          ${extra > 0 ? `<span class="cal-more">+${extra}</span>` : ''}
        </span>
        <span class="cal-dot" aria-hidden="true"></span>`;

      cell.setAttribute(
        'aria-label',
        `${day} : ${dayEvents.length} conférence${dayEvents.length > 1 ? 's' : ''}`
      );
      cell.addEventListener('click', () => openDayModal(key));
    }

    cell.innerHTML = `<span class="cal-day-num">${day}</span>${chips}`;
    els.calGrid.appendChild(cell);
  }
}

/** Carte détaillée d'une conférence à venir (liste / popup). */
function eventCardHtml(ev) {
  const d = new Date(ev.start);
  const rel = relativeLabel(d);
  return `
    <article class="event-card" data-id="${escapeHtml(ev.id)}">
      ${dayboxHtml(d)}
      <div class="event-body">
        <div class="event-meta">
          <span class="event-time">
            <span class="material-symbols-rounded">schedule</span>${escapeHtml(dayTime(d))}
          </span>
          ${
            rel
              ? `<span class="when-pill ${rel.soon ? 'soon' : ''}">${escapeHtml(rel.text)}</span>`
              : ''
          }
        </div>
        <h4 class="event-title">${escapeHtml(ev.title)}</h4>
        ${
          ev.host
            ? `<div class="event-host"><span class="material-symbols-rounded">person</span>${escapeHtml(ev.host)}</div>`
            : ''
        }
        ${ev.description ? `<p class="event-desc">${escapeHtml(ev.description)}</p>` : ''}
        <div class="event-actions">
          ${notifyBtnHtml(ev)}
          ${adminControlsHtml(ev)}
        </div>
      </div>
    </article>`;
}

/** Liste des conférences à venir (la première est aussi mise en avant). */
function renderList() {
  const list = state.events.slice(1);
  els.eventsTitle.hidden = false;
  els.eventsTitle.innerHTML =
    '<span class="material-symbols-rounded">event_upcoming</span> Prochainement' +
    (list.length ? `<span class="events-count">${list.length}</span>` : '');

  if (list.length) {
    // On affiche TOUTES les prochaines conférences : la liste devient
    // défilante au-delà d'une certaine hauteur (voir .is-scrollable en CSS)
    // pour ne pas étirer la page.
    els.eventsList.innerHTML = list.map(eventCardHtml).join('');
    els.eventsList.classList.toggle('is-scrollable', list.length > 2);
  } else {
    els.eventsList.classList.remove('is-scrollable');
    els.eventsList.innerHTML = `
      <div class="side-empty">
        <span class="material-symbols-rounded">event_available</span>
        <p>${
          state.events.length
            ? 'C\'est la seule conférence programmée pour l\'instant.'
            : 'Aucune conférence à venir. Reviens bientôt&nbsp;!'
        }</p>
      </div>`;
  }
}

/** Rendu complet de la vue Calendrier. */
function renderCalendarView() {
  renderCount();
  renderFeatured();
  renderGrid();
  renderList();
}

/** Navigation entre les mois. */
function changeMonth(delta) {
  const d = new Date(state.viewYear, state.viewMonth + delta, 1);
  state.viewYear = d.getFullYear();
  state.viewMonth = d.getMonth();
  renderGrid();
}

/** Ouvre la popup listant les conférences d'un jour donné. */
function openDayModal(key) {
  const dayEvents = state.byDay.get(key) || [];
  if (!dayEvents.length) return;

  els.dayModalTitle.textContent = cap(fmtDateLong.format(new Date(key + 'T00:00:00')));
  els.dayModalBody.innerHTML = dayEvents.map(eventCardHtml).join('');

  openOverlay(els.dayModal);
}

/* =========================== Vue Rediffusions =========================== */

/** Carte d'une conférence passée (rediffusion + évaluation). */
function replayCardHtml(ev) {
  const d = new Date(ev.start);
  const replay = safeUrl(ev.replayUrl);
  const evaluated = Boolean(ev.myEvaluation);
  const ratingBits = [];
  if (typeof ev.ratingAvg === 'number') ratingBits.push(starsHtml(Math.round(ev.ratingAvg)));
  if (ev.ratingCount) {
    ratingBits.push(
      `<span class="rating-count">${
        typeof ev.ratingAvg === 'number' ? ev.ratingAvg.toFixed(1) + ' · ' : ''
      }${ev.ratingCount} avis</span>`
    );
  }

  return `
    <article class="event-card replay-card" data-id="${escapeHtml(ev.id)}">
      <div class="daybox daybox-past">
        <span class="daybox-day">${d.getDate()}</span>
        <span class="daybox-mon">${escapeHtml(monShort(d))}</span>
      </div>
      <div class="event-body">
        <div class="event-meta">
          <span class="event-time past">
            <span class="material-symbols-rounded">history</span>${escapeHtml(cap(fmtPast.format(d)))}
          </span>
          ${ratingBits.length ? `<span class="rating-inline">${ratingBits.join('')}</span>` : ''}
        </div>
        <h4 class="event-title">${escapeHtml(ev.title)}</h4>
        ${
          ev.host
            ? `<div class="event-host"><span class="material-symbols-rounded">person</span>${escapeHtml(ev.host)}</div>`
            : ''
        }
        ${ev.description ? `<p class="event-desc">${escapeHtml(ev.description)}</p>` : ''}
        <div class="event-actions">
          ${
            replay
              ? `<a class="replay-btn" href="${escapeHtml(replay)}" target="_blank" rel="noopener">
                   <span class="material-symbols-rounded">play_circle</span>Voir la rediffusion
                 </a>`
              : '<span class="replay-none"><span class="material-symbols-rounded">videocam_off</span>Rediffusion à venir</span>'
          }
          <button class="eval-btn ${evaluated ? 'done' : ''}" data-eval="${escapeHtml(ev.id)}" type="button">
            <span class="material-symbols-rounded">${evaluated ? 'task_alt' : 'reviews'}</span>
            ${evaluated ? 'Modifier mon avis' : 'Évaluer'}
          </button>
          ${
            ev.survey && ev.survey.length
              ? `<button class="survey-btn ${ev.mySurvey ? 'done' : ''}" data-survey="${escapeHtml(ev.id)}" type="button">
                   <span class="material-symbols-rounded">${ev.mySurvey ? 'task_alt' : 'quiz'}</span>
                   ${ev.mySurvey ? 'Modifier mes réponses' : 'Répondre au questionnaire'}
                 </button>`
              : ''
          }
          ${adminControlsHtml(ev)}
        </div>
      </div>
    </article>`;
}

/** Met à jour le compteur de rediffusions dans la sidebar. */
function updateReplaysBadge() {
  const n = Array.isArray(state.replays) ? state.replays.length : 0;
  els.replaysCount.textContent = n;
  els.replaysCount.hidden = n === 0;
}

/** Rendu de la vue Rediffusions. */
function renderReplaysView() {
  if (state.replaysLoading) {
    els.replaysList.innerHTML = '<div class="replays-loading"><div class="spinner"></div></div>';
    return;
  }
  const list = state.replays || [];
  els.replaysSub.textContent = list.length
    ? `${list.length} conférence${list.length > 1 ? 's' : ''} passée${list.length > 1 ? 's' : ''} · revois-les et partage ton avis.`
    : 'Revois les conférences passées et partage ton avis.';

  els.replaysList.innerHTML = list.length
    ? list.map(replayCardHtml).join('')
    : `<div class="empty-state">
         <span class="material-symbols-rounded">smart_display</span>
         <p>Aucune rediffusion pour l'instant. Elles apparaîtront ici après chaque conférence.</p>
       </div>`;
}

/** Charge (une fois) les conférences passées puis affiche la vue. */
async function loadReplays(force = false) {
  if (state.replays && !force) {
    renderReplaysView();
    return;
  }
  state.replaysLoading = true;
  renderReplaysView();
  try {
    const data = await api('GET', '/api/events/past');
    state.replays = data.events || [];
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast('Impossible de charger les rediffusions.');
    state.replays = [];
  } finally {
    state.replaysLoading = false;
    updateReplaysBadge();
    renderReplaysView();
  }
}

/* ============================ Navigation ============================ */

function setView(view) {
  if (!els.views[view]) return;
  state.view = view;
  els.navItems.forEach((it) => it.classList.toggle('active', it.dataset.view === view));
  Object.entries(els.views).forEach(([name, el]) => (el.hidden = name !== view));
  closeSidebar();
  if (view === 'replays') loadReplays();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ---------------------------- Sidebar mobile ---------------------------- */
function openSidebar() {
  els.sidebar.classList.add('open');
  els.scrim.hidden = false;
  requestAnimationFrame(() => els.scrim.classList.add('show'));
}
function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.scrim.classList.remove('show');
  setTimeout(() => (els.scrim.hidden = true), 200);
}

/* ------------------------- Modales génériques ------------------------- */
function openOverlay(el) {
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
}
function closeOverlay(el) {
  el.classList.remove('show');
  setTimeout(() => (el.hidden = true), 200);
}

/**
 * Boîte de confirmation maison (remplace window.confirm).
 * Renvoie une promesse résolue à true (confirmé) ou false (annulé).
 */
function confirmDialog({ title = 'Confirmation', text = '', okLabel = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmOk.textContent = okLabel;
    els.confirmOk.classList.toggle('btn-danger', danger);
    els.confirmOk.classList.toggle('btn-primary', !danger);
    els.confirmIcon.classList.toggle('danger', danger);
    els.confirmIcon.querySelector('.material-symbols-rounded').textContent = danger ? 'warning' : 'help';

    const done = (val) => {
      closeOverlay(els.confirmModal);
      els.confirmOk.removeEventListener('click', onOk);
      els.confirmCancel.removeEventListener('click', onCancel);
      els.confirmModal.removeEventListener('click', onBackdrop);
      resolve(val);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    const onBackdrop = (e) => {
      if (e.target === els.confirmModal) done(false);
    };
    els.confirmOk.addEventListener('click', onOk);
    els.confirmCancel.addEventListener('click', onCancel);
    els.confirmModal.addEventListener('click', onBackdrop);
    openOverlay(els.confirmModal);
    els.confirmOk.focus();
  });
}

/* ---------------- Rappels (notifications MP) ---------------- */
function updateNotifyButtons(id, on) {
  document.querySelectorAll(`.notify-btn[data-id="${id}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.querySelector('.material-symbols-rounded').textContent = on
      ? 'notifications_active'
      : 'notifications';
    b.querySelector('.notify-label').textContent = on ? 'Rappel activé' : 'Être notifié';
  });
}

async function toggleNotify(btn) {
  const id = btn.dataset.id;
  const on = btn.classList.contains('on');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/events/${id}/notify`, { method: on ? 'DELETE' : 'POST' });
    if (res.status === 401) return showScreen('login');
    if (!res.ok) throw new Error();
    const nowOn = !on;
    const ev = state.events.find((e) => e.id === id);
    if (ev) ev.subscribed = nowOn;
    updateNotifyButtons(id, nowOn);
    showToast(
      nowOn ? 'Rappel activé : le bot t\'enverra un MP 30 min avant.' : 'Rappel désactivé.',
      nowOn
    );
  } catch {
    showToast('Impossible de modifier le rappel.');
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- Ajout / édition d'une conférence (admin) ---------------- */
function findEvent(id) {
  return (
    state.events.find((e) => e.id === id) ||
    (state.replays || []).find((e) => e.id === id) ||
    null
  );
}

function openEventModal(ev) {
  // Si l'on édite depuis la popup d'un jour, on la ferme (elle passerait
  // au-dessus de la modale, car les overlays partagent le même z-index).
  if (!els.dayModal.hidden) closeOverlay(els.dayModal);
  els.eventForm.reset();
  els.eventModalTitle.textContent = ev ? 'Modifier la conférence' : 'Nouvelle conférence';
  els.eventSubmit.textContent = ev ? 'Enregistrer' : 'Créer la conférence';
  els.eventId.value = ev ? ev.id : '';
  els.eventTitle.value = ev ? ev.title || '' : '';
  els.eventHost.value = ev ? ev.host || '' : '';
  els.eventDesc.value = ev ? ev.description || '' : '';
  els.eventReplay.value = ev ? ev.replayUrl || '' : '';
  const start = ev && ev.start ? String(ev.start) : '';
  if (window.Pickers) {
    window.Pickers.setValue(els.eventDate, start.slice(0, 10)); // YYYY-MM-DD
    window.Pickers.setValue(els.eventTime, start.slice(11, 16)); // HH:MM
    window.Pickers.sync();
  }
  openOverlay(els.eventModal);
  els.eventTitle.focus();
}

async function submitEvent(e) {
  e.preventDefault();
  const date = els.eventDate.value;
  const time = els.eventTime.value;
  if (!els.eventTitle.value.trim() || !date || !time) {
    showToast('Titre, date et heure sont obligatoires.');
    return;
  }
  const payload = {
    title: els.eventTitle.value.trim(),
    start: `${date}T${time}:00`,
    host: els.eventHost.value.trim(),
    description: els.eventDesc.value.trim(),
    replayUrl: els.eventReplay.value.trim(),
  };
  const id = els.eventId.value;
  try {
    if (id) await api('PUT', `/api/admin/events/${id}`, payload);
    else await api('POST', '/api/admin/events', payload);
    closeOverlay(els.eventModal);
    showToast(id ? 'Conférence mise à jour.' : 'Conférence ajoutée.', true);
    // Se positionne sur le mois de la conférence pour la voir apparaître.
    const d = new Date(payload.start);
    if (!Number.isNaN(d.getTime())) {
      state.viewYear = d.getFullYear();
      state.viewMonth = d.getMonth();
    }
    await reloadEvents();
    if (state.replays) await loadReplays(true);
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast(err.message || 'Impossible d\'enregistrer la conférence.');
  }
}

async function deleteEvent(ev) {
  const ok = await confirmDialog({
    title: 'Supprimer la conférence',
    text: `Veux-tu vraiment supprimer « ${ev.title} » ? Cette action est définitive.`,
    okLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await api('DELETE', `/api/admin/events/${ev.id}`);
    showToast('Conférence supprimée.', true);
    if (!els.dayModal.hidden) closeOverlay(els.dayModal);
    await reloadEvents();
    if (state.replays) await loadReplays(true);
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast(err.message || 'Impossible de supprimer.');
  }
}

/* ------------------ Proposer une conférence (tous) ------------------- */
function openProposeModal() {
  els.proposeForm.reset();
  if (window.Pickers) window.Pickers.sync();
  openOverlay(els.proposeModal);
  els.proposeSubject.focus();
}

async function submitProposal(e) {
  e.preventDefault();
  const payload = {
    subject: els.proposeSubject.value.trim(),
    sector: els.proposeSector.value,
    details: els.proposeDetails.value.trim(),
  };
  if (!payload.subject || !payload.sector) {
    showToast('Indique au moins un sujet et un secteur.');
    return;
  }
  try {
    await api('POST', '/api/proposals', payload);
    closeOverlay(els.proposeModal);
    showToast('Merci ! Ta proposition a bien été envoyée. 🙌', true);
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast(err.message || 'Impossible d\'envoyer la proposition.');
  }
}

/* --------------------- Évaluer une conférence passée --------------------- */
function setStars(n) {
  els.evalRating.value = n ? String(n) : '';
  els.evalStars.querySelectorAll('.star').forEach((s) => {
    s.classList.toggle('on', Number(s.dataset.v) <= n);
  });
}

function openEvalModal(ev) {
  els.evalForm.reset();
  els.evalEventId.value = ev.id;
  els.evalEventTitle.textContent = ev.title || '';
  const mine = ev.myEvaluation || {};
  els.evalPositive.value = mine.positive || '';
  els.evalImprove.value = mine.improve || '';
  setStars(mine.rating || 0);
  openOverlay(els.evalModal);
}

async function submitEval(e) {
  e.preventDefault();
  const id = els.evalEventId.value;
  const rating = els.evalRating.value ? Number(els.evalRating.value) : null;
  const positive = els.evalPositive.value.trim();
  const improve = els.evalImprove.value.trim();
  if (!rating && !positive && !improve) {
    showToast('Donne au moins une note ou un commentaire.');
    return;
  }
  try {
    const data = await api('POST', `/api/events/${id}/evaluation`, { rating, positive, improve });
    // Met à jour l'évaluation locale et le rendu.
    const ev = findEvent(id);
    if (ev) ev.myEvaluation = data.evaluation;
    closeOverlay(els.evalModal);
    showToast('Merci pour ton retour ! 🙏', true);
    await loadReplays(true);
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast(err.message || 'Impossible d\'envoyer ton avis.');
  }
}

/* ------------------ Questionnaire personnalisé (membre) ------------------ */
/** Construit dynamiquement les champs du questionnaire d'une conférence. */
function renderSurveyForm(ev) {
  const answers = ev.mySurvey || {};
  els.surveyQuestions.innerHTML = ev.survey
    .map((q) => {
      const ans = answers[q.id];
      if (q.type === 'rating') {
        const n = Number(ans) || 0;
        const stars = [1, 2, 3, 4, 5]
          .map(
            (v) =>
              `<button type="button" class="star${v <= n ? ' on' : ''}" data-v="${v}" aria-label="${v}/5"><span class="material-symbols-rounded">star</span></button>`
          )
          .join('');
        return `
          <div class="field survey-q" data-qid="${escapeHtml(q.id)}" data-type="rating">
            <label>${escapeHtml(q.label)}</label>
            <div class="star-input" data-stars>${stars}</div>
            <input type="hidden" class="survey-val" value="${n ? n : ''}" />
          </div>`;
      }
      return `
        <div class="field survey-q" data-qid="${escapeHtml(q.id)}" data-type="text">
          <label>${escapeHtml(q.label)}</label>
          <textarea class="survey-val" rows="3" maxlength="1000">${escapeHtml(ans || '')}</textarea>
        </div>`;
    })
    .join('');

  // Active les étoiles de chaque question de type "note".
  els.surveyQuestions.querySelectorAll('.survey-q[data-type="rating"]').forEach((qEl) => {
    const hidden = qEl.querySelector('.survey-val');
    qEl.querySelectorAll('.star').forEach((s) => {
      s.addEventListener('click', () => {
        const v = Number(s.dataset.v);
        hidden.value = String(v);
        qEl.querySelectorAll('.star').forEach((x) =>
          x.classList.toggle('on', Number(x.dataset.v) <= v)
        );
      });
    });
  });
}

function openSurveyModal(ev) {
  els.surveyEventId.value = ev.id;
  els.surveyEventTitle.textContent = ev.title || '';
  renderSurveyForm(ev);
  openOverlay(els.surveyModal);
}

async function submitSurvey(e) {
  e.preventDefault();
  const id = els.surveyEventId.value;
  const answers = {};
  els.surveyQuestions.querySelectorAll('.survey-q').forEach((qEl) => {
    const qid = qEl.dataset.qid;
    const val = qEl.querySelector('.survey-val').value.trim();
    if (!val) return;
    answers[qid] = qEl.dataset.type === 'rating' ? Number(val) : val;
  });
  if (!Object.keys(answers).length) {
    showToast('Réponds à au moins une question.');
    return;
  }
  try {
    const data = await api('POST', `/api/events/${id}/survey`, { answers });
    const ev = findEvent(id);
    if (ev) ev.mySurvey = data.answers;
    closeOverlay(els.surveyModal);
    showToast('Merci pour tes réponses ! 🙏', true);
    await loadReplays(true);
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast(err.message || 'Impossible d\'envoyer tes réponses.');
  }
}

/* ---------------------- Délégation de clics globale --------------------- */
function onGlobalClick(e) {
  const notif = e.target.closest('.notify-btn');
  if (notif) return toggleNotify(notif);

  const evalBtn = e.target.closest('.eval-btn');
  if (evalBtn) {
    const ev = findEvent(evalBtn.dataset.eval);
    if (ev) openEvalModal(ev);
    return;
  }

  const surveyBtn = e.target.closest('.survey-btn');
  if (surveyBtn) {
    const ev = findEvent(surveyBtn.dataset.survey);
    if (ev) openSurveyModal(ev);
    return;
  }

  const adminBtn = e.target.closest('[data-admin]');
  if (adminBtn) {
    const act = adminBtn.dataset.admin;
    if (act === 'link') return shareFeedbackLink(adminBtn.dataset.id);
    const ev = findEvent(adminBtn.dataset.id);
    if (!ev) return;
    if (act === 'edit') openEventModal(ev);
    else if (act === 'delete') deleteEvent(ev);
  }
}

/**
 * Lien profond « ?feedback=<id> » : ouvre directement le formulaire d'avis
 * (questionnaire personnalisé si présent, sinon l'évaluation) de la conférence.
 */
async function handleFeedbackDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('feedback');
  if (!id) return;
  // Nettoie l'URL pour qu'un rafraîchissement ne rouvre pas la modale.
  window.history.replaceState({}, '', window.location.pathname);
  try {
    const { event } = await api('GET', `/api/events/${encodeURIComponent(id)}`);
    setView('replays');
    if (event.survey && event.survey.length) openSurveyModal(event);
    else openEvalModal(event);
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast(err.message || 'Conférence introuvable pour ce lien.');
  }
}

/** Initialisation. */
async function init() {
  // Navigation par vues (sidebar).
  els.navItems.forEach((it) => it.addEventListener('click', () => setView(it.dataset.view)));
  els.burger.addEventListener('click', openSidebar);
  els.scrim.addEventListener('click', closeSidebar);

  // Calendrier.
  els.calPrev.addEventListener('click', () => changeMonth(-1));
  els.calNext.addEventListener('click', () => changeMonth(1));
  els.dayModalClose.addEventListener('click', () => closeOverlay(els.dayModal));
  els.dayModal.addEventListener('click', (e) => {
    if (e.target === els.dayModal) closeOverlay(els.dayModal);
  });

  // Clics délégués (notify / évaluer / admin edit-delete).
  document.addEventListener('click', onGlobalClick);

  // Échap : ferme la modale ouverte la plus « haute », sinon la sidebar mobile.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.confirmModal.hidden) return; // géré par confirmDialog
    if (!els.surveyModal.hidden) return closeOverlay(els.surveyModal);
    if (!els.evalModal.hidden) return closeOverlay(els.evalModal);
    if (!els.eventModal.hidden) return closeOverlay(els.eventModal);
    if (!els.proposeModal.hidden) return closeOverlay(els.proposeModal);
    if (!els.dayModal.hidden) return closeOverlay(els.dayModal);
    if (els.sidebar.classList.contains('open')) closeSidebar();
  });

  // Proposer une conférence (tous).
  els.proposeBtn.addEventListener('click', openProposeModal);
  els.proposeModalClose.addEventListener('click', () => closeOverlay(els.proposeModal));
  els.proposeCancel.addEventListener('click', () => closeOverlay(els.proposeModal));
  els.proposeModal.addEventListener('click', (e) => {
    if (e.target === els.proposeModal) closeOverlay(els.proposeModal);
  });
  els.proposeForm.addEventListener('submit', submitProposal);

  // Ajout / édition d'une conférence (admins).
  els.addBtn.addEventListener('click', () => openEventModal(null));
  els.quickAdd.addEventListener('click', () => openEventModal(null));
  els.eventModalClose.addEventListener('click', () => closeOverlay(els.eventModal));
  els.eventCancel.addEventListener('click', () => closeOverlay(els.eventModal));
  els.eventModal.addEventListener('click', (e) => {
    if (e.target === els.eventModal) closeOverlay(els.eventModal);
  });
  els.eventForm.addEventListener('submit', submitEvent);

  // Évaluation.
  els.evalStars.querySelectorAll('.star').forEach((s) => {
    s.addEventListener('click', () => setStars(Number(s.dataset.v)));
  });
  els.evalModalClose.addEventListener('click', () => closeOverlay(els.evalModal));
  els.evalCancel.addEventListener('click', () => closeOverlay(els.evalModal));
  els.evalModal.addEventListener('click', (e) => {
    if (e.target === els.evalModal) closeOverlay(els.evalModal);
  });
  els.evalForm.addEventListener('submit', submitEval);

  // Questionnaire personnalisé.
  els.surveyModalClose.addEventListener('click', () => closeOverlay(els.surveyModal));
  els.surveyCancel.addEventListener('click', () => closeOverlay(els.surveyModal));
  els.surveyModal.addEventListener('click', (e) => {
    if (e.target === els.surveyModal) closeOverlay(els.surveyModal);
  });
  els.surveyForm.addEventListener('submit', submitSurvey);

  // Authentification.
  try {
    const me = await fetchMe();
    state.user = me.user;
    state.isAdmin = Boolean(me.isAdmin);
  } catch {
    state.user = null;
  }

  if (!state.user) {
    showScreen('login');
    return;
  }

  // Réglages liés au profil dans la sidebar.
  if (els.sidebarUsername) els.sidebarUsername.textContent = state.user.username || 'Mon profil';
  if (state.isAdmin) {
    els.addBtn.hidden = false;
    els.quickAdd.hidden = false;
    if (els.sidebarAdmin) els.sidebarAdmin.hidden = false;
  }

  try {
    const data = await api('GET', '/api/events');
    state.events = data.events || [];
  } catch (err) {
    if (err.unauthorized) return showScreen('login');
    showToast('Impossible de charger les conférences.');
    state.events = [];
  }

  indexEvents();

  // Mois affiché par défaut : celui de la prochaine conférence, sinon le mois courant.
  const anchor = state.events.length ? new Date(state.events[0].start) : new Date();
  state.viewYear = anchor.getFullYear();
  state.viewMonth = anchor.getMonth();

  renderCalendarView();
  showScreen('calendar');

  // Lien profond éventuel : ouvre le formulaire d'avis de la conférence ciblée.
  handleFeedbackDeepLink();
}

init();
