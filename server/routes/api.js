const express = require('express');
const questionsStore = require('../services/questionsStore');
const eventsStore = require('../services/eventsStore');
const notificationsStore = require('../services/notificationsStore');
const proposalsStore = require('../services/proposalsStore');
const evaluationsStore = require('../services/evaluationsStore');
const surveyResponsesStore = require('../services/surveyResponsesStore');
const { addRoleToMember } = require('../services/discord');
const { markCompleted, recordAnswer } = require('../services/store');
const { config } = require('../config');

const router = express.Router();

/**
 * Middleware : refuse l'accès si l'utilisateur n'est pas connecté via Discord.
 */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Non authentifié. Connecte-toi avec Discord.' });
  }
  next();
}

/**
 * GET /api/questions
 * Renvoie le graphe des questions SANS le mapping des rôles
 * (le client n'a pas à connaître quels rôles sont attribués).
 * On expose `next` et `note` pour permettre la navigation et l'affichage.
 */
router.get('/questions', (req, res) => {
  const { startId, finalId, questions } = questionsStore.get();
  const safe = {};
  for (const [id, q] of Object.entries(questions)) {
    safe[id] = {
      id: q.id,
      question: q.question,
      description: q.description || '',
      multi: q.multi || false,
      next: q.next || null,
      answers: (q.answers || []).map((a) => ({
        value: a.value,
        label: a.label,
        icon: a.icon || null,
        emoji: a.emoji || null,
        note: a.note || null,
        locked: a.locked || false,
        lockedNote: a.lockedNote || null,
        next: a.next || null,
      })),
    };
  }
  res.json({ startId, finalId, questions: safe });
});

/**
 * GET /api/events
 * Renvoie les conférences À VENIR, triées par date croissante.
 * Protégée : seul un utilisateur connecté via Discord peut voir le calendrier.
 * Chaque conférence indique si l'utilisateur courant est abonné au rappel.
 */
router.get('/events', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const events = eventsStore.getUpcoming().map((e) => ({
    ...e,
    subscribed: notificationsStore.isSubscribed(e.id, userId),
  }));
  res.json({ events });
});

/**
 * GET /api/events/past
 * Conférences PASSÉES (rediffusions), plus récentes d'abord. Chaque entrée
 * indique si l'utilisateur courant l'a déjà évaluée (et le résumé des notes).
 */
router.get('/events/past', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const summary = evaluationsStore.summaryByEvent();
  const events = eventsStore.getPast().map((e) => {
    const mine = evaluationsStore.getUserEvaluation(e.id, userId);
    const myResp = e.survey && e.survey.length
      ? surveyResponsesStore.getUserResponse(e.id, userId)
      : null;
    return {
      ...e,
      survey: e.survey || [],
      ratingCount: summary[e.id] ? summary[e.id].count : 0,
      ratingAvg: summary[e.id] ? summary[e.id].avg : null,
      myEvaluation: mine
        ? { rating: mine.rating, positive: mine.positive, improve: mine.improve }
        : null,
      mySurvey: myResp ? myResp.answers : null,
    };
  });
  res.json({ events });
});

/**
 * GET /api/events/:id
 * Détail d'une conférence précise (quel que soit son statut passé/à venir),
 * avec son questionnaire et l'avis déjà donné par l'utilisateur. Sert au lien
 * profond « ?feedback=<id> » envoyé aux membres après une conférence.
 */
router.get('/events/:id', requireAuth, (req, res) => {
  const event = eventsStore.getById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Conférence introuvable.' });
  const userId = req.session.user.id;
  const summary = evaluationsStore.summaryByEvent();
  const mine = evaluationsStore.getUserEvaluation(event.id, userId);
  const myResp = surveyResponsesStore.getUserResponse(event.id, userId);
  res.json({
    event: {
      ...event,
      survey: event.survey || [],
      ratingCount: summary[event.id] ? summary[event.id].count : 0,
      ratingAvg: summary[event.id] ? summary[event.id].avg : null,
      myEvaluation: mine
        ? { rating: mine.rating, positive: mine.positive, improve: mine.improve }
        : null,
      mySurvey: myResp ? myResp.answers : null,
    },
  });
});

/**
 * POST /api/events/:id/survey
 * Body : { answers: { [questionId]: valeur } }
 * Réponses d'un membre au questionnaire personnalisé d'une conférence PASSÉE.
 * Les valeurs sont nettoyées selon le type de chaque question (texte ou note).
 */
router.post('/events/:id/survey', requireAuth, (req, res) => {
  const event = eventsStore.getById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Conférence introuvable.' });

  const survey = Array.isArray(event.survey) ? event.survey : [];
  if (!survey.length) {
    return res.status(400).json({ error: 'Cette conférence n\'a pas de questionnaire.' });
  }

  const started = new Date(event.start).getTime();
  if (Number.isNaN(started) || started > Date.now()) {
    return res.status(400).json({ error: 'On ne peut répondre qu\'à une conférence déjà commencée.' });
  }

  const raw = (req.body && req.body.answers) || {};
  const answers = {};
  for (const q of survey) {
    const v = raw[q.id];
    if (q.type === 'rating') {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n >= 1) answers[q.id] = Math.min(5, Math.max(1, n));
    } else {
      const s = String(v == null ? '' : v).trim().slice(0, 1000);
      if (s) answers[q.id] = s;
    }
  }

  if (!Object.keys(answers).length) {
    return res.status(400).json({ error: 'Merci de répondre à au moins une question.' });
  }

  surveyResponsesStore.upsert({
    eventId: event.id,
    userId: req.session.user.id,
    username: req.session.user.username,
    answers,
  });
  res.json({ ok: true, answers });
});

/**
 * POST /api/events/:id/evaluation
 * Body : { rating (1-5, optionnel), positive, improve }
 * Un membre évalue une conférence PASSÉE. Une évaluation par membre/conférence
 * (les envois suivants remplacent le précédent).
 */
router.post('/events/:id/evaluation', requireAuth, (req, res) => {
  const event = eventsStore.getById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Conférence introuvable.' });

  const started = new Date(event.start).getTime();
  if (Number.isNaN(started) || started > Date.now()) {
    return res.status(400).json({ error: 'On ne peut évaluer qu\'une conférence déjà commencée.' });
  }

  const { rating, positive, improve } = req.body || {};
  if (!rating && !String(positive || '').trim() && !String(improve || '').trim()) {
    return res.status(400).json({ error: 'Donne au moins une note ou un commentaire.' });
  }

  const saved = evaluationsStore.upsert({
    eventId: event.id,
    userId: req.session.user.id,
    username: req.session.user.username,
    rating,
    positive,
    improve,
  });
  res.json({
    ok: true,
    evaluation: { rating: saved.rating, positive: saved.positive, improve: saved.improve },
  });
});

/**
 * POST /api/events/:id/notify   -> active le rappel (MP 30 min avant)
 * DELETE /api/events/:id/notify -> désactive le rappel
 */
router.post('/events/:id/notify', requireAuth, (req, res) => {
  const event = eventsStore.getById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Conférence introuvable.' });
  notificationsStore.subscribe(event.id, req.session.user.id);
  res.json({ ok: true, subscribed: true });
});

router.delete('/events/:id/notify', requireAuth, (req, res) => {
  notificationsStore.unsubscribe(req.params.id, req.session.user.id);
  res.json({ ok: true, subscribed: false });
});

/**
 * POST /api/proposals
 * Un membre propose une conférence (sujet, secteur, détails).
 * La proposition est enregistrée pour être consultée par les admins.
 */
router.post('/proposals', requireAuth, (req, res) => {
  const { subject, sector, details } = req.body || {};
  if (!subject || !String(subject).trim() || !sector || !String(sector).trim()) {
    return res.status(400).json({ error: 'Le sujet et le secteur sont obligatoires.' });
  }
  const proposal = proposalsStore.create({
    userId: req.session.user.id,
    username: req.session.user.username,
    subject,
    sector,
    details,
  });
  res.json({ ok: true, id: proposal.id });
});

/**
 * POST /api/answer
 * Body : { questionId, value }            -> question à choix unique
 *      ou { questionId, values: [...] }   -> question à choix multiple
 * Le serveur détermine le(s) rôle(s) correspondant et les attribue via le bot.
 * Renvoie aussi l'id de la question suivante (`next`).
 */
router.post('/answer', requireAuth, async (req, res) => {
  const { questionId, value, values } = req.body || {};
  const { finalId, completionRoleIds, questions } = questionsStore.get();

  const question = questions[questionId];
  if (!question) {
    return res.status(400).json({ error: 'Question inconnue.' });
  }

  let selected;
  let next;
  let recordedValues;

  if (Array.isArray(values)) {
    // Choix multiple : on garde toutes les réponses sélectionnées valides.
    // Une sélection vide est autorisée (l'utilisateur ne veut aucune notif).
    // Les réponses verrouillées (`locked`) sont ignorées : leur rôle n'est
    // jamais attribué automatiquement (attribution manuelle par les admins).
    selected = question.answers.filter((a) => values.includes(a.value) && !a.locked);
    next = question.next || null;
    recordedValues = selected.map((a) => a.value);
  } else {
    // Choix unique
    const answer = question.answers.find((a) => a.value === value);
    if (!answer) {
      return res.status(400).json({ error: 'Réponse invalide.' });
    }
    // Sécurité : une réponse verrouillée ne peut pas être validée. Le rôle
    // associé (ex. "Pro") est attribué manuellement après vérification admin.
    if (answer.locked) {
      return res.status(403).json({ error: 'Cette réponse n\'est pas disponible. Ouvre un ticket sur Discord pour être vérifié.' });
    }
    selected = [answer];
    next = answer.next || null;
    recordedValues = [answer.value];
  }

  // Agrège les rôles à attribuer (sans doublon).
  const roleIds = [
    ...new Set(selected.flatMap((a) => a.roleIds || [])),
  ];

  // Si l'utilisateur valide la question finale, le questionnaire est terminé :
  // on lui attribue aussi le(s) rôle(s) de complétion.
  if (questionId === finalId) {
    for (const roleId of completionRoleIds || []) {
      if (!roleIds.includes(roleId)) roleIds.push(roleId);
    }
  }

  // Enregistre la réponse (statistiques admin) et la complétion éventuelle.
  const justCompleted = questionId === finalId;
  recordAnswer(req.session.user.id, questionId, recordedValues);

  // Bypass dev : on ne contacte pas l'API Discord (pas de bot token en local).
  // On simule une attribution réussie pour pouvoir tester le parcours.
  if (config.devBypass) {
    console.log('[api/answer] (dev bypass) rôles simulés :', roleIds);
    if (justCompleted) markCompleted(req.session.user.id);
    return res.json({ ok: true, assignedRoles: roleIds, next });
  }

  try {
    for (const roleId of roleIds) {
      await addRoleToMember(req.session.user.id, roleId);
      // Petite pause entre chaque rôle pour limiter le risque de rate limit
      // Discord. Le 429 est de toute façon géré automatiquement (retry) côté
      // service, donc on peut rester court.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (justCompleted) markCompleted(req.session.user.id);
    res.json({ ok: true, assignedRoles: roleIds, next });
  } catch (err) {
    console.error('[api/answer]', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
