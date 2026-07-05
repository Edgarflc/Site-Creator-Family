/**
 * Espace d'administration Creator Family.
 * Onglets : Conférences (CRUD), Questionnaire (éditeur de graphe), Statistiques.
 * Réservé aux administrateurs (contrôle côté serveur ; l'UI vérifie /auth/me).
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const screens = {
  loading: $('#screen-loading'),
  denied: $('#screen-denied'),
  admin: $('#screen-admin'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => (el.hidden = k !== name));
}

let toastTimer;
function showToast(message, ok = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('toast-ok', ok);
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => (toast.hidden = true), 300);
  }, 3500);
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Appel API JSON. Lève une erreur avec le message serveur si non-2xx. */
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
  return data;
}

function rolesToCsv(arr) {
  return (arr || []).join(', ');
}
function csvToRoles(str) {
  return String(str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ============================ Onglets ============================ */
function initTabs() {
  $$('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.admin-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.tab;
      $$('.admin-panel').forEach((p) => (p.hidden = p.id !== `tab-${name}`));
      if (name === 'stats') loadStats();
      if (name === 'proposals') loadProposals();
    });
  });
}

/* ========================== Conférences ========================== */
const fmtEventDate = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'full',
  timeStyle: 'short',
});

async function loadEvents() {
  try {
    const { events } = await api('GET', '/api/admin/events');
    renderEvents(events);
  } catch (err) {
    showToast(err.message);
  }
}

function renderEvents(events) {
  const list = $('#events-admin-list');
  if (!events.length) {
    list.innerHTML = '<p class="admin-empty">Aucune conférence. Ajoute-en une !</p>';
    return;
  }
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
  const now = Date.now();
  list.innerHTML = sorted
    .map((ev) => {
      const past = new Date(ev.start).getTime() < now;
      let when = ev.start;
      const d = new Date(ev.start);
      if (!Number.isNaN(d.getTime())) when = escapeHtml(fmtEventDate.format(d));
      return `
        <div class="admin-row ${past ? 'is-past' : ''}" data-id="${escapeHtml(ev.id)}">
          <div class="admin-row-main">
            <div class="admin-row-title">
              ${escapeHtml(ev.title)}
              ${past ? '<span class="pill-past">passée</span>' : ''}
            </div>
            <div class="admin-row-meta">
              <span><span class="material-symbols-rounded">event</span>${when}</span>
              ${ev.host ? `<span><span class="material-symbols-rounded">person</span>${escapeHtml(ev.host)}</span>` : ''}
            </div>
            ${ev.description ? `<div class="admin-row-desc">${escapeHtml(ev.description)}</div>` : ''}
          </div>
          <div class="admin-row-actions">
            <button class="icon-btn" data-act="edit" title="Modifier">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="icon-btn danger" data-act="delete" title="Supprimer">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>`;
    })
    .join('');

  list.querySelectorAll('.admin-row').forEach((row) => {
    const id = row.dataset.id;
    const ev = events.find((e) => e.id === id);
    row.querySelector('[data-act="edit"]').addEventListener('click', () => openEventModal(ev));
    row.querySelector('[data-act="delete"]').addEventListener('click', () => deleteEvent(ev));
  });
}

function openEventModal(ev) {
  $('#event-modal-title').textContent = ev ? 'Modifier la conférence' : 'Nouvelle conférence';
  $('#event-id').value = ev ? ev.id : '';
  $('#event-title').value = ev ? ev.title : '';
  const start = ev && ev.start ? String(ev.start) : '';
  window.Pickers.setValue($('#event-date'), start.slice(0, 10)); // YYYY-MM-DD
  window.Pickers.setValue($('#event-time'), start.slice(11, 16)); // HH:MM
  $('#event-host').value = ev ? ev.host || '' : '';
  $('#event-desc').value = ev ? ev.description || '' : '';
  openModal('#event-modal');
}

async function submitEvent(e) {
  e.preventDefault();
  const date = $('#event-date').value;
  const time = $('#event-time').value;
  if (!date || !time) {
    showToast('Merci d\'indiquer la date ET l\'heure.');
    return;
  }
  const start = `${date}T${time}:00`; // ISO local
  const payload = {
    title: $('#event-title').value.trim(),
    start,
    host: $('#event-host').value.trim(),
    description: $('#event-desc').value.trim(),
  };
  const id = $('#event-id').value;
  try {
    if (id) await api('PUT', `/api/admin/events/${id}`, payload);
    else await api('POST', '/api/admin/events', payload);
    closeModal('#event-modal');
    showToast('Conférence enregistrée.', true);
    loadEvents();
  } catch (err) {
    showToast(err.message);
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
    loadEvents();
  } catch (err) {
    showToast(err.message);
  }
}

/* ========================== Modales ========================== */
function openModal(sel) {
  const m = $(sel);
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('show'));
}
function closeModal(sel) {
  const m = $(sel);
  m.classList.remove('show');
  setTimeout(() => (m.hidden = true), 200);
}

/**
 * Boîte de confirmation maison (remplace window.confirm).
 * Renvoie une promesse résolue à true (confirmé) ou false (annulé).
 */
function confirmDialog({ title = 'Confirmation', text = '', okLabel = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    const okBtn = $('#confirm-ok');
    const cancelBtn = $('#confirm-cancel');
    const overlay = $('#confirm-modal');
    const icon = $('#confirm-icon');

    okBtn.textContent = okLabel;
    okBtn.classList.toggle('btn-danger', danger);
    okBtn.classList.toggle('btn-primary', !danger);
    icon.classList.toggle('danger', danger);
    icon.querySelector('.material-symbols-rounded').textContent = danger ? 'warning' : 'help';

    const done = (val) => {
      closeModal('#confirm-modal');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    const onBackdrop = (e) => {
      if (e.target === overlay) done(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    openModal('#confirm-modal');
    okBtn.focus();
  });
}

/* ========================= Questionnaire ========================= */
function field(labelText, className, value, placeholder, list) {
  return `
    <div class="field">
      <label>${labelText}</label>
      <input class="${className}" type="text" value="${escapeHtml(value)}"
             placeholder="${escapeHtml(placeholder || '')}" ${list ? `list="${list}"` : ''} />
    </div>`;
}

function createAnswerEditor(a = {}) {
  const node = document.createElement('div');
  node.className = 'a-editor';
  node.innerHTML = `
    <div class="a-grid">
      ${field('value *', 'a-value', a.value || '', 'identifiant')}
      ${field('Label *', 'a-label', a.label || '', 'texte affiché')}
      ${field('Icône', 'a-icon', a.icon || '', 'material symbol')}
      ${field('Emoji', 'a-emoji', a.emoji || '', '🌱')}
      ${field('Note', 'a-note', a.note || '', 'petit texte')}
      ${field('roleIds', 'a-roles', rolesToCsv(a.roleIds), 'id1, id2')}
      ${field('next', 'a-next', a.next || '', 'id question / vide', 'qids')}
    </div>
    <div class="a-flags">
      <label class="chk"><input type="checkbox" class="a-locked" ${a.locked ? 'checked' : ''}/> Verrouillée</label>
      <input class="a-lockednote" type="text" value="${escapeHtml(a.lockedNote || '')}" placeholder="Message si verrouillée" />
      <button class="icon-btn danger a-remove" type="button" title="Supprimer la réponse">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>`;
  node.querySelector('.a-remove').addEventListener('click', () => node.remove());
  return node;
}

function createQuestionEditor(id, q = {}) {
  const node = document.createElement('div');
  node.className = 'q-editor admin-card';
  node.innerHTML = `
    <div class="q-head">
      ${field('id de la question *', 'q-id', id || '', 'ex: arrivee')}
      <button class="icon-btn danger q-remove" type="button" title="Supprimer la question">
        <span class="material-symbols-rounded">delete</span>
      </button>
    </div>
    ${field('Question *', 'q-question', q.question || '', 'texte de la question')}
    ${field('Description', 'q-description', q.description || '', 'optionnel')}
    <div class="q-opts">
      <label class="chk"><input type="checkbox" class="q-multi" ${q.multi ? 'checked' : ''}/> Choix multiple</label>
      <div class="field inline">
        <label>next global</label>
        <input class="q-next" type="text" value="${escapeHtml(q.next || '')}" placeholder="id / vide" list="qids" />
      </div>
    </div>
    <div class="answers-editor"></div>
    <button class="btn-ghost-admin small a-add" type="button">
      <span class="material-symbols-rounded">add</span> Ajouter une réponse
    </button>`;

  const answersEl = node.querySelector('.answers-editor');
  (q.answers || []).forEach((a) => answersEl.appendChild(createAnswerEditor(a)));
  node.querySelector('.a-add').addEventListener('click', () =>
    answersEl.appendChild(createAnswerEditor())
  );
  node.querySelector('.q-remove').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Supprimer la question',
      text: 'Cette question et ses réponses seront retirées de l\'éditeur. Pense à enregistrer ensuite.',
      okLabel: 'Supprimer',
      danger: true,
    });
    if (ok) node.remove();
  });
  return node;
}

async function loadQuestions() {
  try {
    const data = await api('GET', '/api/admin/questions');
    $('#cfg-start').value = data.startId || '';
    $('#cfg-final').value = data.finalId || '';
    $('#cfg-completion').value = rolesToCsv(data.completionRoleIds);
    const list = $('#questions-list');
    list.innerHTML = '';
    for (const [id, q] of Object.entries(data.questions || {})) {
      list.appendChild(createQuestionEditor(id, q));
    }
  } catch (err) {
    showToast(err.message);
  }
}

function serializeQuestions() {
  const questions = {};
  $$('#questions-list .q-editor').forEach((qEl) => {
    const id = qEl.querySelector('.q-id').value.trim();
    if (!id) return;
    const q = {
      id,
      question: qEl.querySelector('.q-question').value.trim(),
      description: qEl.querySelector('.q-description').value.trim(),
      multi: qEl.querySelector('.q-multi').checked,
      next: qEl.querySelector('.q-next').value.trim() || null,
      answers: [],
    };
    qEl.querySelectorAll('.a-editor').forEach((aEl) => {
      const value = aEl.querySelector('.a-value').value.trim();
      if (!value) return;
      const answer = {
        value,
        label: aEl.querySelector('.a-label').value.trim(),
        roleIds: csvToRoles(aEl.querySelector('.a-roles').value),
        next: aEl.querySelector('.a-next').value.trim() || null,
      };
      const icon = aEl.querySelector('.a-icon').value.trim();
      const emoji = aEl.querySelector('.a-emoji').value.trim();
      const note = aEl.querySelector('.a-note').value.trim();
      if (icon) answer.icon = icon;
      if (emoji) answer.emoji = emoji;
      if (note) answer.note = note;
      if (aEl.querySelector('.a-locked').checked) {
        answer.locked = true;
        const ln = aEl.querySelector('.a-lockednote').value.trim();
        if (ln) answer.lockedNote = ln;
      }
      q.answers.push(answer);
    });
    questions[id] = q;
  });
  return {
    startId: $('#cfg-start').value.trim(),
    finalId: $('#cfg-final').value.trim() || null,
    completionRoleIds: csvToRoles($('#cfg-completion').value),
    questions,
  };
}

async function saveQuestions() {
  try {
    await api('PUT', '/api/admin/questions', serializeQuestions());
    showToast('Questionnaire enregistré.', true);
    loadQuestions();
  } catch (err) {
    showToast(err.message);
  }
}

/* ========================== Propositions ========================== */
const fmtPropDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

async function loadProposals() {
  try {
    const { proposals } = await api('GET', '/api/admin/proposals');
    renderProposals(proposals);
  } catch (err) {
    showToast(err.message);
  }
}

function updateProposalsBadge(n) {
  const badge = $('#proposals-badge');
  if (!badge) return;
  badge.textContent = n;
  badge.hidden = n === 0;
}

function renderProposals(proposals) {
  updateProposalsBadge(proposals.length);
  const list = $('#proposals-list');
  if (!proposals.length) {
    list.innerHTML = '<p class="admin-empty">Aucune proposition pour le moment.</p>';
    return;
  }
  list.innerHTML = proposals
    .map((p) => {
      let when = '';
      const d = new Date(p.createdAt);
      if (!Number.isNaN(d.getTime())) when = escapeHtml(fmtPropDate.format(d));
      return `
        <div class="admin-row" data-id="${escapeHtml(p.id)}">
          <div class="admin-row-main">
            <div class="admin-row-title">
              ${escapeHtml(p.subject)}
              ${p.sector ? `<span class="sector-pill">${escapeHtml(p.sector)}</span>` : ''}
            </div>
            <div class="admin-row-meta">
              <span><span class="material-symbols-rounded">person</span>${escapeHtml(p.username)}</span>
              <span><span class="material-symbols-rounded">schedule</span>${when}</span>
            </div>
            ${p.details ? `<div class="admin-row-desc">${escapeHtml(p.details)}</div>` : ''}
          </div>
          <div class="admin-row-actions">
            <button class="icon-btn" data-act="use" title="Créer une conférence à partir de cette idée">
              <span class="material-symbols-rounded">add_circle</span>
            </button>
            <button class="icon-btn danger" data-act="delete" title="Supprimer">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>`;
    })
    .join('');

  list.querySelectorAll('.admin-row').forEach((row) => {
    const id = row.dataset.id;
    const p = proposals.find((x) => x.id === id);
    row.querySelector('[data-act="delete"]').addEventListener('click', () => deleteProposal(p));
    row.querySelector('[data-act="use"]').addEventListener('click', () => useProposal(p));
  });
}

/** Pré-remplit le formulaire conférence à partir d'une proposition. */
function useProposal(p) {
  openEventModal(null);
  $('#event-title').value = p.subject || '';
  const extra = p.details ? `${p.details}\n\n` : '';
  $('#event-desc').value = `${extra}(Proposé par ${p.username}${p.sector ? ` — ${p.sector}` : ''})`;
  $('#event-title').focus();
}

async function deleteProposal(p) {
  const ok = await confirmDialog({
    title: 'Supprimer la proposition',
    text: `Supprimer la proposition « ${p.subject} » ?`,
    okLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await api('DELETE', `/api/admin/proposals/${p.id}`);
    showToast('Proposition supprimée.', true);
    loadProposals();
  } catch (err) {
    showToast(err.message);
  }
}

/* ========================== Statistiques ========================== */
async function loadStats() {
  try {
    const stats = await api('GET', '/api/admin/stats');
    renderStats(stats);
  } catch (err) {
    showToast(err.message);
  }
}

function renderStats(stats) {
  $('#stat-tiles').innerHTML = `
    <div class="stat-tile">
      <div class="stat-num">${stats.members}</div>
      <div class="stat-label">Membres enregistrés</div>
    </div>
    <div class="stat-tile">
      <div class="stat-num">${stats.completed}</div>
      <div class="stat-label">Questionnaires terminés</div>
    </div>`;

  const container = $('#stats-questions');
  const questions = Object.values(stats.perQuestion || {});
  if (!questions.length) {
    container.innerHTML = '<p class="admin-empty">Aucune donnée pour le moment.</p>';
    return;
  }
  container.innerHTML = questions
    .map((q) => {
      const max = Math.max(1, ...q.answers.map((a) => q.counts[a.value] || 0));
      const bars = q.answers
        .map((a) => {
          const n = q.counts[a.value] || 0;
          const pct = Math.round((n / max) * 100);
          return `
            <div class="bar-row">
              <div class="bar-label">${escapeHtml(a.label || a.value)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <div class="bar-val">${n}</div>
            </div>`;
        })
        .join('');
      return `
        <div class="admin-card stat-q">
          <h3 class="stat-q-title">${escapeHtml(q.question)}</h3>
          <div class="bars">${bars}</div>
        </div>`;
    })
    .join('');
}

/* ============================== Init ============================== */
async function init() {
  // Vérifie les droits (le serveur protège aussi chaque route et la page).
  let me = null;
  try {
    me = await (await fetch('/auth/me')).json();
  } catch {
    /* ignore */
  }
  if (!me || !me.user || !me.isAdmin) {
    showScreen('denied');
    return;
  }

  initTabs();

  // Conférences
  $('#event-new').addEventListener('click', () => openEventModal(null));
  $('#event-form').addEventListener('submit', submitEvent);
  $('#event-cancel').addEventListener('click', () => closeModal('#event-modal'));
  $('#event-modal-close').addEventListener('click', () => closeModal('#event-modal'));
  $('#event-modal').addEventListener('click', (e) => {
    if (e.target === $('#event-modal')) closeModal('#event-modal');
  });

  // Questionnaire
  $('#question-add').addEventListener('click', () => {
    $('#questions-list').appendChild(createQuestionEditor(''));
  });
  $('#questions-save').addEventListener('click', saveQuestions);

  // Propositions
  $('#proposals-refresh').addEventListener('click', loadProposals);

  // Stats
  $('#stats-refresh').addEventListener('click', loadStats);

  // Déconnexion
  $('#btn-logout').addEventListener('click', async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    window.location.href = '/';
  });

  await Promise.all([loadEvents(), loadQuestions(), loadProposals()]);
  showScreen('admin');
}

init();
