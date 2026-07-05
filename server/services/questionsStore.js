/**
 * Persistance du questionnaire (graphe de questions), éditable depuis l'admin.
 *
 * Seed initial depuis le fichier statique `data/questions.js`, puis tout passe
 * par `.data/questions.json`. La forme est identique à celle du module d'origine :
 *   { startId, finalId, completionRoleIds, questions }
 */

const fs = require('fs');
const path = require('path');
const seed = require('../data/questions');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'questions.json');

let cache = null;

function defaultData() {
  return {
    startId: seed.startId,
    finalId: seed.finalId,
    completionRoleIds: seed.completionRoleIds || [],
    questions: seed.questions || {},
  };
}

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = defaultData();
    persist();
  }
  return cache;
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[questionsStore] écriture impossible :', err.message);
  }
}

/** Renvoie une copie profonde du graphe complet (avec roleIds). */
function get() {
  return JSON.parse(JSON.stringify(load()));
}

/**
 * Valide et enregistre un nouveau graphe complet.
 * Renvoie { ok: true } ou { ok: false, error }.
 */
function save(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Données invalides.' };
  }
  const questions = data.questions;
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    return { ok: false, error: 'Le champ "questions" est invalide.' };
  }
  const ids = Object.keys(questions);
  if (!ids.length) {
    return { ok: false, error: 'Il faut au moins une question.' };
  }
  if (!questions[data.startId]) {
    return { ok: false, error: 'La question de départ (startId) est introuvable.' };
  }
  if (data.finalId && !questions[data.finalId]) {
    return { ok: false, error: 'La question finale (finalId) est introuvable.' };
  }
  // Cohérence : chaque `next` renseigné doit pointer vers une question existante.
  for (const [qid, q] of Object.entries(questions)) {
    if (q.next && !questions[q.next]) {
      return { ok: false, error: `La question "${qid}" pointe vers un "next" inconnu (${q.next}).` };
    }
    for (const a of q.answers || []) {
      if (a.next && !questions[a.next]) {
        return { ok: false, error: `Une réponse de "${qid}" pointe vers un "next" inconnu (${a.next}).` };
      }
    }
  }

  cache = {
    startId: data.startId,
    finalId: data.finalId || null,
    completionRoleIds: Array.isArray(data.completionRoleIds) ? data.completionRoleIds : [],
    questions,
  };
  persist();
  return { ok: true };
}

module.exports = { get, save };
