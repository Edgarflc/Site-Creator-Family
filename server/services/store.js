/**
 * Persistance par utilisateur Discord :
 *   - complétion du questionnaire (pour ne plus l'imposer à chaque visite) ;
 *   - dernières réponses données (pour les statistiques de l'espace admin).
 *
 * Fichier `.data/completions.json` :
 *   { [userId]: { completedAt: ISO, answers: { [questionId]: [values] } } }
 *
 * ⚠️ FS potentiellement éphémère en hébergement (Railway sans volume) : au pire
 * les données sont réinitialisées au redéploiement. Sur un VPS c'est durable.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'completions.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[store] écriture impossible :', err.message);
  }
}

function entry(userId) {
  load();
  if (!cache[userId]) cache[userId] = {};
  return cache[userId];
}

/** L'utilisateur a-t-il déjà terminé le questionnaire au moins une fois ? */
function hasCompleted(userId) {
  if (!userId) return false;
  return Boolean(load()[userId] && load()[userId].completedAt);
}

/** Marque le questionnaire comme terminé pour cet utilisateur. */
function markCompleted(userId) {
  if (!userId) return;
  entry(userId).completedAt = new Date().toISOString();
  persist();
}

/**
 * Enregistre la (les) réponse(s) données à une question (écrase la précédente,
 * afin que refaire le questionnaire remplace au lieu de cumuler).
 */
function recordAnswer(userId, questionId, values) {
  if (!userId || !questionId) return;
  const e = entry(userId);
  if (!e.answers) e.answers = {};
  e.answers[questionId] = Array.isArray(values) ? values : [values];
  persist();
}

/**
 * Statistiques agrégées pour l'admin, à partir du graphe de questions fourni
 * (pour retrouver les libellés). Ne renvoie que des compteurs, aucune donnée
 * nominative.
 */
function getStats(questionsData) {
  const data = load();
  const userIds = Object.keys(data);
  const completed = userIds.filter((id) => data[id].completedAt).length;

  const questions = (questionsData && questionsData.questions) || {};
  const perQuestion = {};

  for (const [qid, q] of Object.entries(questions)) {
    const counts = {};
    for (const a of q.answers || []) counts[a.value] = 0;
    perQuestion[qid] = {
      question: q.question,
      answers: q.answers || [],
      counts,
      total: 0,
    };
  }

  for (const id of userIds) {
    const answers = data[id].answers || {};
    for (const [qid, values] of Object.entries(answers)) {
      const bucket = perQuestion[qid];
      if (!bucket) continue;
      for (const v of values) {
        if (v in bucket.counts) {
          bucket.counts[v] += 1;
          bucket.total += 1;
        }
      }
    }
  }

  return { members: userIds.length, completed, perQuestion };
}

module.exports = { hasCompleted, markCompleted, recordAnswer, getStats };
