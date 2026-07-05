/**
 * Creator Family - logique frontend
 * - Vérifie la connexion Discord
 * - Affiche une question par page avec transitions
 * - Envoie chaque réponse au serveur (qui attribue les rôles)
 */

const screens = {
  login: document.getElementById('screen-login'),
  quiz: document.getElementById('screen-quiz'),
  done: document.getElementById('screen-done'),
  loading: document.getElementById('screen-loading'),
};

const els = {
  btnLogin: document.getElementById('btn-login'),
  btnRestart: document.getElementById('btn-restart'),
  loginHint: document.getElementById('login-hint'),
  userChip: document.getElementById('user-chip'),
  stage: document.getElementById('question-stage'),
  progressBar: document.getElementById('progress-bar'),
  progressLabel: document.getElementById('progress-label'),
  toast: document.getElementById('toast'),
};

const state = {
  user: null,
  completed: false, // le questionnaire a-t-il déjà été terminé une fois ?
  questions: {}, // dictionnaire { id: question }
  startId: null,
  finalId: null, // question toujours posée en dernier
  currentId: null,
  answered: 0, // nombre de questions déjà répondues
  queue: [], // ids des questions de branchement en attente (parcours multiples)
  finalDone: false, // la question finale a-t-elle déjà été posée ?
};

/** Affiche un seul écran à la fois. */
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

/** Petit toast d'erreur. */
let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => (els.toast.hidden = true), 300);
  }, 4000);
}

/** Messages d'erreur OAuth renvoyés via ?auth=... */
function readAuthError() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  if (!auth) return;
  const messages = {
    denied: 'Connexion annulée.',
    invalid: 'Session invalide, réessaie.',
    error: 'Une erreur est survenue lors de la connexion.',
  };
  if (messages[auth]) els.loginHint.textContent = messages[auth];
  // Nettoie l'URL
  window.history.replaceState({}, '', '/');
}

/** Récupère l'utilisateur connecté + son état de complétion. */
async function fetchMe() {
  const res = await fetch('/auth/me');
  const data = await res.json();
  return data; // { user, completed }
}

/** Récupère le graphe des questions. */
async function fetchQuestions() {
  const res = await fetch('/api/questions');
  const data = await res.json();
  return data; // { startId, questions }
}

/** Envoie une réponse au serveur (value unique, ou tableau pour le multi-choix). */
async function submitAnswer(questionId, value) {
  const payload = Array.isArray(value)
    ? { questionId, values: value }
    : { questionId, value };
  const res = await fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Erreur lors de l\'enregistrement de ta réponse.');
  }
  return data;
}

/** Affiche le profil utilisateur dans l'en-tête. */
function renderUserChip() {
  if (!state.user) return;
  const avatar = state.user.avatar
    ? `<img src="${state.user.avatar}" alt="" />`
    : '';
  els.userChip.innerHTML = `${avatar}<span>${escapeHtml(state.user.username)}</span>`;
}

/**
 * Calcule la profondeur maximale restante à partir d'une question
 * (le parcours le plus long jusqu'à une fin), pour estimer la progression.
 */
function maxDepthFrom(id, visited = new Set()) {
  const q = state.questions[id];
  if (!q || visited.has(id)) return 0;
  visited.add(id);
  let max = 1;
  for (const a of q.answers) {
    let depth;
    if (a.next) {
      depth = 1 + maxDepthFrom(a.next, new Set(visited));
    } else if (id !== state.finalId && state.finalId && state.questions[state.finalId]) {
      // Chemin terminé : la question finale est ajoutée automatiquement après.
      depth = 2;
    } else {
      depth = 1;
    }
    if (depth > max) max = depth;
  }
  return max;
}

/** Met à jour la barre de progression (total estimé selon le parcours). */
function updateProgress() {
  const remaining = maxDepthFrom(state.currentId) + state.queue.length; // questions restantes (current incluse + parcours en attente)
  const total = state.answered + remaining;
  const current = state.answered + 1;
  els.progressBar.style.width = `${(state.answered / total) * 100}%`;
  els.progressLabel.textContent = `${current} / ${total}`;
}

/** Affiche la question courante. */
function renderQuestion() {
  const q = state.questions[state.currentId];
  if (!q) return finish();

  updateProgress();

  // Une question multi qui possède des icônes/emojis garde l'esthétique
  // "cartes" du choix unique (.cards) ; sinon elle adopte le style liste
  // avec cases à cocher (ex : notifications).
  const multiCards = q.multi && q.answers.some((a) => a.icon || a.emoji);
  const answersClass =
    'answers' + (q.multi ? ' multi' : '') + (multiCards ? ' cards' : '');

  const block = document.createElement('div');
  block.className = 'question-block enter';
  block.innerHTML = `
    <div class="q-step">Question ${state.answered + 1}</div>
    <h2 class="q-text">${escapeHtml(q.question)}</h2>
    ${q.description ? `<p class="q-desc">${escapeHtml(q.description)}</p>` : ''}
    <div class="${answersClass}"></div>
  `;

  const answersEl = block.querySelector('.answers');
  q.answers.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = 'answer';
    const iconHtml = a.icon
      ? `<span class="material-symbols-rounded answer-icon">${escapeHtml(a.icon)}</span>`
      : a.emoji
        ? `<span class="emoji">${a.emoji}</span>`
        : '';

    // Réponse verrouillée : affichée mais non cliquable. On indique sous le
    // libellé comment obtenir le rôle (ticket Discord + vérification admin).
    if (a.locked) {
      btn.classList.add('locked');
      btn.type = 'button';
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.innerHTML = `
        <span class="lock-badge material-symbols-rounded">lock</span>
        ${iconHtml}
        <span class="answer-label">${escapeHtml(a.label)}</span>
        ${a.note ? `<span class="answer-note">${escapeHtml(a.note)}</span>` : ''}
        ${a.lockedNote ? `<span class="answer-locked-note">${escapeHtml(a.lockedNote)}</span>` : ''}
      `;
      answersEl.appendChild(btn);
      return;
    }

    btn.innerHTML = `
      ${iconHtml}
      <span class="answer-label">${escapeHtml(a.label)}</span>
      ${a.note ? `<span class="answer-note">${escapeHtml(a.note)}</span>` : ''}
    `;
    if (q.multi) {
      btn.dataset.value = a.value;
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
    } else {
      btn.addEventListener('click', () => handleAnswer(q, a, btn, answersEl));
    }
    answersEl.appendChild(btn);
  });

  // Question à choix multiple : bouton de validation.
  if (q.multi) {
    const confirm = document.createElement('button');
    confirm.className = 'btn btn-discord confirm-multi';
    confirm.type = 'button';
    confirm.innerHTML = '<span class="confirm-label">Valider mes choix</span>';
    confirm.addEventListener('click', () => handleMultiAnswer(q, confirm, answersEl));
    block.appendChild(confirm);
  }

  els.stage.innerHTML = '';
  els.stage.appendChild(block);
}

/**
 * Détermine la (les) question(s) suivante(s) après `question`.
 *
 * `nextIds` est la liste des ids de suivi issus de la / des réponse(s)
 * sélectionnée(s) (une seule en choix unique, potentiellement plusieurs en
 * choix multiple). Tous les parcours de suivi sont empilés dans `state.queue`
 * puis visités l'un après l'autre. La question finale (`finalId`) est toujours
 * posée en dernier, une seule fois, quand plus aucun parcours n'est en attente.
 */
function advance(question, nextIds) {
  state.answered += 1;

  // Empile les nouveaux parcours de suivi (sans doublon, hors question finale).
  for (const id of nextIds) {
    if (
      id &&
      state.questions[id] &&
      id !== state.finalId &&
      id !== state.currentId &&
      !state.queue.includes(id)
    ) {
      state.queue.push(id);
    }
  }

  // Prochaine question : d'abord la file, sinon la question finale (une fois).
  let target = state.queue.shift() || null;
  if (
    !target &&
    question.id !== state.finalId &&
    !state.finalDone &&
    state.finalId &&
    state.questions[state.finalId]
  ) {
    target = state.finalId;
  }

  if (target && state.questions[target]) {
    state.currentId = target;
    if (target === state.finalId) state.finalDone = true;
    renderQuestion();
  } else {
    finish();
  }
}

/** Gère le clic sur une réponse (choix unique). */
async function handleAnswer(question, answer, btn, answersEl) {
  // Empêche les double-clics
  const buttons = answersEl.querySelectorAll('.answer');
  buttons.forEach((b) => (b.disabled = true));
  btn.classList.add('selected', 'loading');

  try {
    const result = await submitAnswer(question.id, answer.value);
    // Transition de sortie puis question suivante (selon le graphe)
    const block = els.stage.querySelector('.question-block');
    block.classList.remove('enter');
    block.classList.add('leave');
    setTimeout(() => {
      const nextId = result.next || answer.next || null;
      advance(question, nextId ? [nextId] : []);
    }, 350);
  } catch (err) {
    showToast(err.message);
    buttons.forEach((b) => (b.disabled = false));
    btn.classList.remove('selected', 'loading');
  }
}

/** Gère la validation d'une question à choix multiple. */
async function handleMultiAnswer(question, confirmBtn, answersEl) {
  const buttons = answersEl.querySelectorAll('.answer');
  const values = Array.from(answersEl.querySelectorAll('.answer.selected')).map(
    (b) => b.dataset.value
  );

  buttons.forEach((b) => (b.disabled = true));
  confirmBtn.disabled = true;
  confirmBtn.classList.add('loading');

  try {
    const result = await submitAnswer(question.id, values);
    const block = els.stage.querySelector('.question-block');
    block.classList.remove('enter');
    block.classList.add('leave');
    setTimeout(() => {
      // Une question multi peut mener à PLUSIEURS parcours de suivi :
      // on collecte le `next` de chaque réponse cochée (+ un éventuel
      // `next` défini au niveau de la question).
      const selectedAnswers = question.answers.filter((a) => values.includes(a.value));
      const nextIds = selectedAnswers.map((a) => a.next).filter(Boolean);
      const fallback = result.next || question.next || null;
      if (fallback) nextIds.push(fallback);
      advance(question, nextIds);
    }, 350);
  } catch (err) {
    showToast(err.message);
    buttons.forEach((b) => (b.disabled = false));
    confirmBtn.disabled = false;
    confirmBtn.classList.remove('loading');
  }
}

/** Fin du questionnaire. */
function finish() {
  els.progressBar.style.width = '100%';
  state.completed = true; // désormais, l'accueil s'affichera à la place du quiz
  showScreen('done');
}

/** Démarre / redémarre le questionnaire. */
function startQuiz() {
  state.answered = 0;
  state.queue = [];
  state.finalDone = false;
  state.currentId = state.startId;
  renderUserChip();
  showScreen('quiz');
  renderQuestion();
}


/** Échappe le HTML pour éviter toute injection. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Initialisation. */
async function init() {
  readAuthError();
  els.btnLogin.addEventListener('click', () => {
    window.location.href = '/auth/login';
  });
  els.btnRestart.addEventListener('click', startQuiz);

  // `?redo=1` : l'utilisateur veut explicitement refaire le questionnaire
  // (depuis le panneau profil), même s'il l'a déjà terminé.
  const forceRedo = new URLSearchParams(window.location.search).get('redo') === '1';

  try {
    const me = await fetchMe();
    state.user = me.user;
    state.completed = me.completed;
  } catch {
    state.user = null;
  }

  if (!state.user) {
    showScreen('login');
    return;
  }

  // Déjà rempli et pas de demande explicite de refaire → direction le
  // calendrier des conférences (page d'accueil des membres).
  if (state.completed && !forceRedo) {
    window.location.replace('/calendrier');
    return;
  }

  // Nettoie l'URL du paramètre ?redo pour ne pas le conserver.
  if (forceRedo) window.history.replaceState({}, '', '/');

  try {
    const data = await fetchQuestions();
    state.questions = data.questions || {};
    state.startId = data.startId || null;
    state.finalId = data.finalId || null;
  } catch {
    showToast('Impossible de charger les questions.');
    showScreen('login');
    return;
  }

  if (!state.startId || !state.questions[state.startId]) {
    showToast('Aucune question configurée.');
    showScreen('login');
    return;
  }

  startQuiz();
}

init();
