/**
 * Persistance des propositions de conférences soumises par les membres.
 * Consultables par les admins dans l'espace d'administration.
 *
 * Fichier `.data/proposals.json` : tableau de propositions
 *   { id, userId, username, subject, sector, details, createdAt }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const FILE = path.join(DATA_DIR, 'proposals.json');

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
    console.error('[proposalsStore] écriture impossible :', err.message);
  }
}

/** Limite la longueur pour éviter les abus. */
function clip(str, max) {
  return String(str || '').trim().slice(0, max);
}

function create({ userId, username, subject, sector, details }) {
  load();
  const proposal = {
    id: 'prop-' + crypto.randomBytes(4).toString('hex'),
    userId: userId || null,
    username: clip(username, 80) || 'Inconnu',
    subject: clip(subject, 120),
    sector: clip(sector, 60),
    details: clip(details, 1000),
    createdAt: new Date().toISOString(),
  };
  cache.unshift(proposal); // les plus récentes en tête
  persist();
  return proposal;
}

/** Toutes les propositions (plus récentes d'abord). */
function getAll() {
  return load().map((p) => ({ ...p }));
}

function remove(id) {
  load();
  const before = cache.length;
  cache = cache.filter((p) => p.id !== id);
  const removed = cache.length < before;
  if (removed) persist();
  return removed;
}

module.exports = { create, getAll, remove };
