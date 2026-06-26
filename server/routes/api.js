const express = require('express');
const { startId, finalId, completionRoleIds, questions } = require('../data/questions');
const { addRoleToMember } = require('../services/discord');

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
  const safe = {};
  for (const [id, q] of Object.entries(questions)) {
    safe[id] = {
      id: q.id,
      question: q.question,
      description: q.description || '',
      multi: q.multi || false,
      next: q.next || null,
      answers: q.answers.map((a) => ({
        value: a.value,
        label: a.label,
        icon: a.icon || null,
        emoji: a.emoji || null,
        note: a.note || null,
        next: a.next || null,
      })),
    };
  }
  res.json({ startId, finalId, questions: safe });
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

  const question = questions[questionId];
  if (!question) {
    return res.status(400).json({ error: 'Question inconnue.' });
  }

  let selected;
  let next;

  if (Array.isArray(values)) {
    // Choix multiple : on garde toutes les réponses sélectionnées valides.
    // Une sélection vide est autorisée (l'utilisateur ne veut aucune notif).
    selected = question.answers.filter((a) => values.includes(a.value));
    next = question.next || null;
  } else {
    // Choix unique
    const answer = question.answers.find((a) => a.value === value);
    if (!answer) {
      return res.status(400).json({ error: 'Réponse invalide.' });
    }
    selected = [answer];
    next = answer.next || null;
  }

  // Agrège les rôles à attribuer (sans doublon).
  const roleIds = [
    ...new Set(selected.flatMap((a) => a.roleIds || [])),
  ];

  // Si l'utilisateur valide la question finale, le questionnaire est terminé :
  // on lui attribue aussi le(s) rôle(s) de complétion.
  if (questionId === finalId) {
    for (const roleId of completionRoleIds) {
      if (!roleIds.includes(roleId)) roleIds.push(roleId);
    }
  }

  try {
    for (const roleId of roleIds) {
      await addRoleToMember(req.session.user.id, roleId);
      // Petite pause entre chaque rôle pour éviter de déclencher le rate limit
      // Discord lorsqu'une réponse attribue plusieurs rôles d'un coup.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    res.json({ ok: true, assignedRoles: roleIds, next });
  } catch (err) {
    console.error('[api/answer]', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
