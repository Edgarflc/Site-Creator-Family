/**
 * API d'administration (réservée aux IDs Discord admin, voir config.isAdmin).
 * Permet de gérer les conférences, le questionnaire et de consulter les stats.
 */

const express = require('express');
const { isAdmin } = require('../config');
const eventsStore = require('../services/eventsStore');
const questionsStore = require('../services/questionsStore');
const notificationsStore = require('../services/notificationsStore');
const proposalsStore = require('../services/proposalsStore');
const { getStats } = require('../services/store');

const router = express.Router();

/** Middleware : réservé aux administrateurs connectés. */
function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  if (!isAdmin(req.session.user.id)) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  next();
}

router.use(requireAdmin);

/* ----------------------------- Conférences ----------------------------- */

// Toutes les conférences (y compris passées), pour la gestion.
router.get('/events', (req, res) => {
  res.json({ events: eventsStore.getAll() });
});

router.post('/events', (req, res) => {
  const { title, start } = req.body || {};
  if (!title || !start) {
    return res.status(400).json({ error: 'Titre et date/heure sont obligatoires.' });
  }
  res.json({ event: eventsStore.create(req.body) });
});

router.put('/events/:id', (req, res) => {
  const { title, start } = req.body || {};
  if (!title || !start) {
    return res.status(400).json({ error: 'Titre et date/heure sont obligatoires.' });
  }
  const updated = eventsStore.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Conférence introuvable.' });
  res.json({ event: updated });
});

router.delete('/events/:id', (req, res) => {
  const ok = eventsStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Conférence introuvable.' });
  notificationsStore.removeEvent(req.params.id); // retire les abonnements liés
  res.json({ ok: true });
});

/* ----------------------------- Questionnaire ---------------------------- */

// Graphe complet AVEC les roleIds (réservé admin).
router.get('/questions', (req, res) => {
  res.json(questionsStore.get());
});

router.put('/questions', (req, res) => {
  const result = questionsStore.save(req.body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

/* ---------------------------- Propositions ------------------------------ */

router.get('/proposals', (req, res) => {
  res.json({ proposals: proposalsStore.getAll() });
});

router.delete('/proposals/:id', (req, res) => {
  const ok = proposalsStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Proposition introuvable.' });
  res.json({ ok: true });
});

/* ------------------------------ Statistiques ---------------------------- */

router.get('/stats', (req, res) => {
  res.json(getStats(questionsStore.get()));
});

module.exports = router;
