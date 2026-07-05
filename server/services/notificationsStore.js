/**
 * Abonnements aux rappels de conférences.
 * Quand un utilisateur active « Être notifié » sur une conférence, il est
 * enregistré ici. Un planificateur (reminderScheduler) envoie ensuite un MP
 * 30 min avant le début, et marque le rappel comme envoyé (anti-doublon).
 *
 * Fichier `.data/notifications.json` :
 *   {
 *     subs: { [eventId]: [userId, ...] },
 *     sent: { "eventId:userId": ISO }   // rappels déjà envoyés
 *   }
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'notifications.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = { subs: {}, sent: {} };
  }
  if (!cache.subs) cache.subs = {};
  if (!cache.sent) cache.sent = {};
  return cache;
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[notificationsStore] écriture impossible :', err.message);
  }
}

function subscribe(eventId, userId) {
  load();
  if (!cache.subs[eventId]) cache.subs[eventId] = [];
  if (!cache.subs[eventId].includes(userId)) cache.subs[eventId].push(userId);
  persist();
}

function unsubscribe(eventId, userId) {
  load();
  if (cache.subs[eventId]) {
    cache.subs[eventId] = cache.subs[eventId].filter((id) => id !== userId);
    if (!cache.subs[eventId].length) delete cache.subs[eventId];
  }
  // On retire aussi l'éventuel marqueur "envoyé" pour permettre un futur rappel.
  delete cache.sent[`${eventId}:${userId}`];
  persist();
}

function isSubscribed(eventId, userId) {
  load();
  return Boolean(cache.subs[eventId] && cache.subs[eventId].includes(userId));
}

/** Tous les eventIds auxquels l'utilisateur est abonné (pour marquer l'UI). */
function subscribedEventIds(userId) {
  load();
  return Object.keys(cache.subs).filter((eid) => cache.subs[eid].includes(userId));
}

function getSubscribers(eventId) {
  load();
  return (cache.subs[eventId] || []).slice();
}

function wasSent(eventId, userId) {
  load();
  return Boolean(cache.sent[`${eventId}:${userId}`]);
}

function markSent(eventId, userId) {
  load();
  cache.sent[`${eventId}:${userId}`] = new Date().toISOString();
  persist();
}

/** Nettoyage quand une conférence est supprimée. */
function removeEvent(eventId) {
  load();
  delete cache.subs[eventId];
  for (const key of Object.keys(cache.sent)) {
    if (key.startsWith(`${eventId}:`)) delete cache.sent[key];
  }
  persist();
}

module.exports = {
  subscribe,
  unsubscribe,
  isSubscribed,
  subscribedEventIds,
  getSubscribers,
  wasSent,
  markSent,
  removeEvent,
};
