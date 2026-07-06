/**
 * Persistance des conférences (calendrier), éditables depuis l'espace admin.
 *
 * Au premier lancement, la liste est initialisée (seed) à partir du fichier
 * statique `data/events.js`. Ensuite, tout passe par `.data/events.json`
 * (ignoré par git), modifié via l'API admin.
 *
 * Même mise en garde que pour `store.js` : sur un hébergement à FS éphémère
 * (Railway sans volume), le fichier est réinitialisé au redéploiement.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { events: seedEvents } = require('../data/events');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'events.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(cache)) cache = [];
  } catch {
    // Pas encore de fichier : on part des conférences par défaut.
    cache = seedEvents.map((e) => ({ ...e }));
    persist();
  }
  return cache;
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[eventsStore] écriture impossible :', err.message);
  }
}

function genId() {
  return 'conf-' + crypto.randomBytes(4).toString('hex');
}

/** Nettoie/normalise les champs d'une conférence issus du client. */
function sanitize(input) {
  return {
    title: String(input.title || '').trim(),
    start: String(input.start || '').trim(),
    host: String(input.host || '').trim(),
    description: String(input.description || '').trim(),
    replayUrl: String(input.replayUrl || '').trim(),
  };
}

/**
 * Nettoie le questionnaire personnalisé d'une conférence : une liste de
 * questions { id, type: 'text'|'rating', label }. Les libellés vides sont
 * retirés ; un id stable est conservé (ou généré) pour mapper les réponses.
 */
function sanitizeSurvey(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((q) => ({
      id: String((q && q.id) || '').trim() || 'q-' + crypto.randomBytes(3).toString('hex'),
      type: q && q.type === 'rating' ? 'rating' : 'text',
      label: String((q && q.label) || '').trim().slice(0, 200),
    }))
    .filter((q) => q.label)
    .slice(0, 20);
}

/** Toutes les conférences (ordre de saisie), pour l'admin. */
function getAll() {
  return load().map((e) => ({ ...e }));
}

/** Une conférence par son id, ou null. */
function getById(id) {
  const found = load().find((e) => e.id === id);
  return found ? { ...found } : null;
}

/** Conférences à venir, triées par date croissante (pour le calendrier public). */
function getUpcoming() {
  const now = Date.now();
  return load()
    .filter((e) => {
      const t = new Date(e.start).getTime();
      return !Number.isNaN(t) && t >= now - 2 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map((e) => ({ ...e }));
}

/**
 * Conférences PASSÉES, triées de la plus récente à la plus ancienne.
 * Alimente l'onglet « Rediffusions » (replays + évaluations).
 */
function getPast() {
  const now = Date.now();
  return load()
    .filter((e) => {
      const t = new Date(e.start).getTime();
      return !Number.isNaN(t) && t < now - 2 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .map((e) => ({ ...e }));
}

function create(input) {
  load();
  const data = sanitize(input);
  const event = { id: genId(), ...data, survey: sanitizeSurvey(input.survey) };
  cache.push(event);
  persist();
  return event;
}

function update(id, input) {
  load();
  const idx = cache.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const merged = { ...cache[idx], ...sanitize(input), id };
  // Le questionnaire n'est mis à jour que s'il est explicitement fourni : ainsi,
  // éditer une conférence depuis le calendrier (qui n'envoie pas `survey`) ne
  // supprime pas le questionnaire créé dans l'espace admin.
  if (input.survey !== undefined) merged.survey = sanitizeSurvey(input.survey);
  cache[idx] = merged;
  persist();
  return cache[idx];
}

function remove(id) {
  load();
  const before = cache.length;
  cache = cache.filter((e) => e.id !== id);
  const removed = cache.length < before;
  if (removed) persist();
  return removed;
}

module.exports = { getAll, getById, getUpcoming, getPast, create, update, remove };
