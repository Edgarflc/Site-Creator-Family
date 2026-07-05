/**
 * Planificateur des rappels de conférences.
 * Vérifie régulièrement les conférences à venir et envoie un MP Discord aux
 * utilisateurs abonnés ~30 min avant le début (une seule fois par personne).
 */

const eventsStore = require('./eventsStore');
const notificationsStore = require('./notificationsStore');
const { sendDirectMessage } = require('./discord');
const { config } = require('../config');

const REMINDER_MS = 30 * 60 * 1000; // 30 minutes avant le début
const CHECK_INTERVAL_MS = 60 * 1000; // vérification toutes les minutes

const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Message envoyé en MP. */
function buildMessage(event) {
  const when = fmtTime.format(new Date(event.start));
  let msg = `⏰ **Rappel Creator Family**\n\nLa conférence **${event.title}** commence dans 30 minutes (à ${when}) !`;
  if (event.host) msg += `\n👤 Animée par ${event.host}`;
  if (event.description) msg += `\n\n${event.description}`;
  msg += `\n\nÀ tout de suite ! 🎬`;
  return msg;
}

async function checkAndSend() {
  const now = Date.now();

  // En dev bypass (pas de bot configuré), on ne peut pas envoyer de MP.
  const canSend = Boolean(config.discord.botToken) && !config.devBypass;

  for (const event of eventsStore.getAll()) {
    const start = new Date(event.start).getTime();
    if (Number.isNaN(start)) continue;

    // Fenêtre : entre 30 min avant le début et le début.
    if (now < start - REMINDER_MS || now >= start) continue;

    const subscribers = notificationsStore.getSubscribers(event.id);
    for (const userId of subscribers) {
      if (notificationsStore.wasSent(event.id, userId)) continue;

      if (!canSend) {
        // On marque quand même pour éviter des logs répétés en dev.
        console.log(`[rappel] (simulé) MP à ${userId} pour « ${event.title} »`);
        notificationsStore.markSent(event.id, userId);
        continue;
      }

      try {
        await sendDirectMessage(userId, buildMessage(event));
        notificationsStore.markSent(event.id, userId);
        console.log(`[rappel] MP envoyé à ${userId} pour « ${event.title} »`);
      } catch (err) {
        // MP fermés / pas de serveur commun… : on marque comme envoyé pour ne
        // pas boucler indéfiniment sur le même utilisateur.
        console.error(`[rappel] échec MP à ${userId} :`, err.message);
        notificationsStore.markSent(event.id, userId);
      }
    }
  }
}

function start() {
  // Première passe rapide au démarrage, puis à intervalle régulier.
  setTimeout(() => {
    checkAndSend().catch((e) => console.error('[rappel]', e.message));
  }, 5000);
  setInterval(() => {
    checkAndSend().catch((e) => console.error('[rappel]', e.message));
  }, CHECK_INTERVAL_MS);
}

module.exports = { start, checkAndSend };
