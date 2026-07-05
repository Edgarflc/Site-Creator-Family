/**
 * Creator Family - calendrier des conférences.
 * - Vérifie la connexion Discord (écran de connexion sinon).
 * - Met en avant la prochaine conférence.
 * - Affiche une grille mensuelle où les conférences apparaissent DANS les cases.
 * - Liste détaillée des conférences suivantes.
 */

const screens = {
  login: document.getElementById('screen-login'),
  calendar: document.getElementById('screen-calendar'),
  loading: document.getElementById('screen-loading'),
};

const els = {
  calMonth: document.getElementById('cal-month'),
  calGrid: document.getElementById('cal-grid'),
  calPrev: document.getElementById('cal-prev'),
  calNext: document.getElementById('cal-next'),
  calCount: document.getElementById('cal-count'),
  featured: document.getElementById('cal-featured'),
  eventsList: document.getElementById('events-list'),
  eventsTitle: document.getElementById('events-title'),
  toast: document.getElementById('toast'),
  dayModal: document.getElementById('day-modal'),
  dayModalTitle: document.getElementById('day-modal-title'),
  dayModalBody: document.getElementById('day-modal-body'),
  dayModalClose: document.getElementById('day-modal-close'),
  addBtn: document.getElementById('cal-add-btn'),
  eventModal: document.getElementById('event-modal'),
  eventModalClose: document.getElementById('event-modal-close'),
  eventCancel: document.getElementById('event-cancel'),
  eventForm: document.getElementById('event-form'),
  eventTitle: document.getElementById('event-title'),
  eventDate: document.getElementById('event-date'),
  eventTime: document.getElementById('event-time'),
  eventHost: document.getElementById('event-host'),
  eventDesc: document.getElementById('event-desc'),
  proposeBtn: document.getElementById('cal-propose-btn'),
  proposeModal: document.getElementById('propose-modal'),
  proposeModalClose: document.getElementById('propose-modal-close'),
  proposeCancel: document.getElementById('propose-cancel'),
  proposeForm: document.getElementById('propose-form'),
  proposeSubject: document.getElementById('propose-subject'),
  proposeSector: document.getElementById('propose-sector'),
  proposeDetails: document.getElementById('propose-details'),
};

const state = {
  user: null,
  isAdmin: false,
  events: [], // conférences à venir, triées par date
  byDay: new Map(), // 'YYYY-MM-DD' -> [events]
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Première lettre en majuscule (les libellés FR d'Intl sont en minuscule). */
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Récupère l'utilisateur connecté (+ statut admin). */
async function fetchMe() {
  const res = await fetch('/auth/me');
  return res.json(); // { user, isAdmin, ... }
}

/** Recharge les conférences depuis le serveur et rafraîchit l'affichage. */
async function reloadEvents() {
  state.events = await fetchEvents();
  indexEvents();
  renderAll();
}

/** Récupère les conférences à venir (route protégée). */
async function fetchEvents() {
  const res = await fetch('/api/events');
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.unauthorized = true;
    throw err;
  }
  const data = await res.json();
  return data.events || [];
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

/** Bouton "Être notifié" (rappel MP 30 min avant). */
function notifyBtnHtml(ev) {
  const on = ev.subscribed;
  return `
    <button class="notify-btn ${on ? 'on' : ''}" data-id="${escapeHtml(ev.id)}" type="button">
      <span class="material-symbols-rounded">${on ? 'notifications_active' : 'notifications'}</span>
      <span class="notify-label">${on ? 'Rappel activé' : 'Être notifié'}</span>
    </button>`;
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
        <div class="event-actions">${notifyBtnHtml(ev)}</div>
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

/** Carte détaillée d'une conférence (liste). */
function eventCardHtml(ev) {
  const d = new Date(ev.start);
  const rel = relativeLabel(d);
  return `
    <article class="event-card">
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
        <div class="event-actions">${notifyBtnHtml(ev)}</div>
      </div>
    </article>`;
}

/** Liste des conférences suivantes (la première est déjà mise en avant). */
function renderList() {
  const list = state.events.slice(1);
  els.eventsTitle.textContent = 'Les conférences suivantes';
  els.eventsTitle.hidden = list.length === 0;

  if (list.length) {
    els.eventsList.innerHTML = list.map(eventCardHtml).join('');
  } else if (!state.events.length) {
    els.eventsList.innerHTML =
      '<p class="events-empty">Aucune conférence programmée pour le moment. Reviens bientôt&nbsp;!</p>';
  } else {
    // Une seule conférence : elle est déjà mise en avant, rien à lister.
    els.eventsList.innerHTML = '';
  }
}

/** Ouvre la popup listant les conférences d'un jour donné. */
function openDayModal(key) {
  const dayEvents = state.byDay.get(key) || [];
  if (!dayEvents.length) return;

  els.dayModalTitle.textContent = cap(fmtDateLong.format(new Date(key + 'T00:00:00')));
  els.dayModalBody.innerHTML = dayEvents.map(eventCardHtml).join('');

  els.dayModal.hidden = false;
  requestAnimationFrame(() => els.dayModal.classList.add('show'));
}

function closeDayModal() {
  els.dayModal.classList.remove('show');
  setTimeout(() => (els.dayModal.hidden = true), 200);
}

/** Met à jour visuellement tous les boutons de rappel d'une conférence. */
function updateNotifyButtons(id, on) {
  document.querySelectorAll(`.notify-btn[data-id="${id}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.querySelector('.material-symbols-rounded').textContent = on
      ? 'notifications_active'
      : 'notifications';
    b.querySelector('.notify-label').textContent = on ? 'Rappel activé' : 'Être notifié';
  });
}

/** Active / désactive le rappel pour une conférence. */
async function toggleNotify(btn) {
  const id = btn.dataset.id;
  const on = btn.classList.contains('on');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/events/${id}/notify`, { method: on ? 'DELETE' : 'POST' });
    if (res.status === 401) {
      showScreen('login');
      return;
    }
    if (!res.ok) throw new Error();
    const nowOn = !on;
    const ev = state.events.find((e) => e.id === id);
    if (ev) ev.subscribed = nowOn;
    updateNotifyButtons(id, nowOn);
    showToast(
      nowOn
        ? 'Rappel activé : le bot t\'enverra un MP 30 min avant.'
        : 'Rappel désactivé.',
      nowOn
    );
  } catch {
    showToast('Impossible de modifier le rappel.');
  } finally {
    btn.disabled = false;
  }
}

/** Rendu complet. */
function renderAll() {
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
  renderAll();
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

/* -------------------- Ajout d'une conférence (admin) ------------------ */
function openEventModal() {
  els.eventForm.reset();
  if (window.Pickers) window.Pickers.sync();
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
  };
  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur.');
    closeOverlay(els.eventModal);
    showToast('Conférence ajoutée.', true);
    // Se positionne sur le mois de la conférence créée pour la voir apparaître.
    const d = new Date(payload.start);
    if (!Number.isNaN(d.getTime())) {
      state.viewYear = d.getFullYear();
      state.viewMonth = d.getMonth();
    }
    await reloadEvents();
  } catch (err) {
    showToast(err.message || 'Impossible de créer la conférence.');
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
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      showScreen('login');
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Erreur.');
    closeOverlay(els.proposeModal);
    showToast('Merci ! Ta proposition a bien été envoyée. 🙌', true);
  } catch (err) {
    showToast(err.message || 'Impossible d\'envoyer la proposition.');
  }
}

/** Initialisation. */
async function init() {
  els.calPrev.addEventListener('click', () => changeMonth(-1));
  els.calNext.addEventListener('click', () => changeMonth(1));
  els.dayModalClose.addEventListener('click', closeDayModal);
  els.dayModal.addEventListener('click', (e) => {
    if (e.target === els.dayModal) closeDayModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.dayModal.hidden) closeDayModal();
    if (!els.proposeModal.hidden) closeOverlay(els.proposeModal);
    if (!els.eventModal.hidden) closeOverlay(els.eventModal);
  });
  // Clic sur un bouton "Être notifié" (featured, liste ou popup).
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.notify-btn');
    if (btn) toggleNotify(btn);
  });

  // Proposer une conférence (tous les utilisateurs).
  els.proposeBtn.addEventListener('click', openProposeModal);
  els.proposeModalClose.addEventListener('click', () => closeOverlay(els.proposeModal));
  els.proposeCancel.addEventListener('click', () => closeOverlay(els.proposeModal));
  els.proposeModal.addEventListener('click', (e) => {
    if (e.target === els.proposeModal) closeOverlay(els.proposeModal);
  });
  els.proposeForm.addEventListener('submit', submitProposal);

  // Ajout rapide d'une conférence (admins).
  els.addBtn.addEventListener('click', openEventModal);
  els.eventModalClose.addEventListener('click', () => closeOverlay(els.eventModal));
  els.eventCancel.addEventListener('click', () => closeOverlay(els.eventModal));
  els.eventModal.addEventListener('click', (e) => {
    if (e.target === els.eventModal) closeOverlay(els.eventModal);
  });
  els.eventForm.addEventListener('submit', submitEvent);

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

  // Le bouton d'ajout rapide n'apparaît que pour les admins.
  if (state.isAdmin) els.addBtn.hidden = false;

  try {
    state.events = await fetchEvents();
  } catch (err) {
    if (err.unauthorized) {
      showScreen('login');
      return;
    }
    showToast('Impossible de charger les conférences.');
    state.events = [];
  }

  indexEvents();

  // Mois affiché par défaut : celui de la prochaine conférence, sinon le mois courant.
  const anchor = state.events.length ? new Date(state.events[0].start) : new Date();
  state.viewYear = anchor.getFullYear();
  state.viewMonth = anchor.getMonth();

  renderAll();
  showScreen('calendar');
}

init();
