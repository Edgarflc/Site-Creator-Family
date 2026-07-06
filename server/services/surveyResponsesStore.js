/**
 * Persistance des réponses aux questionnaires personnalisés de conférences.
 *
 * Chaque conférence peut porter un questionnaire sur mesure (champ `survey` de
 * l'événement : une liste de questions « texte » ou « note »). Les membres y
 * répondent depuis l'onglet Rediffusions. Une réponse par membre et par
 * conférence (les envois suivants remplacent le précédent).
 *
 * Fichier `.data/surveyResponses.json` : tableau de réponses
 *   { id, eventId, userId, username, answers: { [questionId]: valeur }, createdAt, updatedAt }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'surveyResponses.json');

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
    console.error('[surveyResponsesStore] écriture impossible :', err.message);
  }
}

function clip(str, max) {
  return String(str || '').trim().slice(0, max);
}

/**
 * Enregistre (ou met à jour) la réponse d'un membre au questionnaire d'une
 * conférence. `answers` est un objet { questionId: valeur } déjà nettoyé par
 * l'appelant (selon le type de chaque question).
 */
function upsert({ eventId, userId, username, answers }) {
  load();
  const clean = answers && typeof answers === 'object' ? answers : {};
  const idx = cache.findIndex((r) => r.eventId === eventId && r.userId === userId);
  if (idx !== -1) {
    cache[idx] = { ...cache[idx], answers: clean, updatedAt: new Date().toISOString() };
    persist();
    return cache[idx];
  }
  const response = {
    id: 'resp-' + crypto.randomBytes(4).toString('hex'),
    eventId,
    userId: userId || null,
    username: clip(username, 80) || 'Inconnu',
    answers: clean,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  cache.unshift(response);
  persist();
  return response;
}

/** La réponse d'un membre pour une conférence donnée, ou null. */
function getUserResponse(eventId, userId) {
  const found = load().find((r) => r.eventId === eventId && r.userId === userId);
  return found ? { ...found } : null;
}

/** Toutes les réponses d'une conférence (plus récentes d'abord). */
function getByEvent(eventId) {
  return load()
    .filter((r) => r.eventId === eventId)
    .map((r) => ({ ...r }));
}

/** Nombre de réponses par conférence : { [eventId]: count }. */
function countByEvent() {
  const out = {};
  for (const r of load()) out[r.eventId] = (out[r.eventId] || 0) + 1;
  return out;
}

/** Supprime toutes les réponses liées à une conférence (à sa suppression). */
function removeEvent(eventId) {
  load();
  const before = cache.length;
  cache = cache.filter((r) => r.eventId !== eventId);
  if (cache.length < before) persist();
}

module.exports = { upsert, getUserResponse, getByEvent, countByEvent, removeEvent };
