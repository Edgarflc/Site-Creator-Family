/**
 * Persistance des évaluations de conférences (bilan « à chaud »).
 *
 * Après une conférence PASSÉE, un membre peut donner son avis : une note sur 5,
 * ce qui allait bien, et ce qui peut être amélioré. Une seule évaluation par
 * membre et par conférence (les envois suivants remplacent le précédent).
 *
 * Fichier `.data/evaluations.json` : tableau d'évaluations
 *   { id, eventId, userId, username, rating, positive, improve, createdAt, updatedAt }
 *
 * Même mise en garde que les autres stores : FS potentiellement éphémère selon
 * l'hébergement (durable sur un VPS avec disque).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'evaluations.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(cache)) cache = [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[evaluationsStore] écriture impossible :', err.message);
  }
}

function clip(str, max) {
  return String(str || '').trim().slice(0, max);
}

/** Contraint la note dans l'intervalle 1..5 (entier), ou null si absente. */
function normRating(rating) {
  const n = Math.round(Number(rating));
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, n));
}

/**
 * Enregistre (ou met à jour) l'évaluation d'un membre pour une conférence.
 * Renvoie l'évaluation stockée.
 */
function upsert({ eventId, userId, username, rating, positive, improve }) {
  load();
  const data = {
    rating: normRating(rating),
    positive: clip(positive, 1000),
    improve: clip(improve, 1000),
  };
  const idx = cache.findIndex((e) => e.eventId === eventId && e.userId === userId);
  if (idx !== -1) {
    cache[idx] = { ...cache[idx], ...data, updatedAt: new Date().toISOString() };
    persist();
    return cache[idx];
  }
  const evaluation = {
    id: 'eval-' + crypto.randomBytes(4).toString('hex'),
    eventId,
    userId: userId || null,
    username: clip(username, 80) || 'Inconnu',
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  cache.unshift(evaluation);
  persist();
  return evaluation;
}

/** L'évaluation d'un membre pour une conférence donnée, ou null. */
function getUserEvaluation(eventId, userId) {
  const found = load().find((e) => e.eventId === eventId && e.userId === userId);
  return found ? { ...found } : null;
}

/** Toutes les évaluations d'une conférence (plus récentes d'abord). */
function getByEvent(eventId) {
  return load()
    .filter((e) => e.eventId === eventId)
    .map((e) => ({ ...e }));
}

/**
 * Résumé par conférence : { [eventId]: { count, avg } }.
 * `avg` est la moyenne des notes renseignées (arrondie à 0,1), ou null.
 */
function summaryByEvent() {
  const acc = {};
  for (const e of load()) {
    if (!acc[e.eventId]) acc[e.eventId] = { count: 0, sum: 0, rated: 0 };
    acc[e.eventId].count += 1;
    if (typeof e.rating === 'number') {
      acc[e.eventId].sum += e.rating;
      acc[e.eventId].rated += 1;
    }
  }
  const out = {};
  for (const [id, v] of Object.entries(acc)) {
    out[id] = {
      count: v.count,
      avg: v.rated ? Math.round((v.sum / v.rated) * 10) / 10 : null,
    };
  }
  return out;
}

/** Toutes les évaluations (plus récentes d'abord), pour l'admin. */
function getAll() {
  return load().map((e) => ({ ...e }));
}

/** Supprime une évaluation par son id (modération admin). Renvoie true si trouvée. */
function removeById(id) {
  load();
  const before = cache.length;
  cache = cache.filter((e) => e.id !== id);
  if (cache.length === before) return false;
  persist();
  return true;
}

/** Supprime toutes les évaluations liées à une conférence (à sa suppression). */
function removeEvent(eventId) {
  load();
  const before = cache.length;
  cache = cache.filter((e) => e.eventId !== eventId);
  if (cache.length < before) persist();
}

module.exports = {
  upsert,
  getUserEvaluation,
  getByEvent,
  summaryByEvent,
  getAll,
  removeById,
  removeEvent,
};
