require('dotenv').config();

/**
 * Centralise et valide la configuration issue des variables d'environnement.
 */
/**
 * Détermine l'URL publique du site.
 * Priorité :
 *   1. BASE_URL explicite (.env ou variable Railway).
 *   2. Domaine public fourni automatiquement par Railway (RAILWAY_PUBLIC_DOMAIN).
 *   3. Fallback local.
 * Cela évite d'avoir à mettre à jour BASE_URL à la main à chaque déploiement Railway.
 */
function resolveBaseUrl() {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return 'http://localhost:3000';
}

// IDs Discord des administrateurs du site (gestion complète : conférences,
// questionnaire, statistiques). Modifiable via la variable d'environnement
// ADMIN_DISCORD_IDS (liste séparée par des virgules) sinon cette liste par défaut.
const DEFAULT_ADMIN_IDS = [
  '382919310596636684',
  '522693531421245450',
  '740967536799252542',
  '239833787280785409',
  '515884259576381441',
];

function resolveAdminIds() {
  if (process.env.ADMIN_DISCORD_IDS) {
    return process.env.ADMIN_DISCORD_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_IDS;
}

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: resolveBaseUrl(),
  sessionSecret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  adminIds: resolveAdminIds(),
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    botToken: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
  },
};

config.discord.redirectUri = `${config.baseUrl}/auth/callback`;

/**
 * Bypass d'authentification pour le développement local.
 * Actif si DEV_BYPASS_AUTH=true, OU automatiquement en local (localhost)
 * quand les identifiants Discord ne sont pas configurés.
 * En prod (HTTPS + credentials présents), il reste désactivé.
 */
config.devBypass =
  process.env.DEV_BYPASS_AUTH === 'true' ||
  (config.baseUrl.startsWith('http://localhost') && !config.discord.clientId);

/**
 * Vérifie au démarrage que les variables essentielles sont présentes.
 * Affiche un avertissement clair plutôt que de planter avec une erreur obscure.
 */
function validateConfig() {
  const missing = [];
  if (!config.discord.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.discord.clientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!config.discord.botToken) missing.push('DISCORD_BOT_TOKEN');
  if (!config.discord.guildId) missing.push('DISCORD_GUILD_ID');

  if (missing.length > 0) {
    console.warn(
      '\n⚠️  Variables d\'environnement manquantes : ' +
        missing.join(', ') +
        '\n   Copie .env.example en .env et renseigne les valeurs.\n'
    );
  }

  if (config.devBypass) {
    console.warn(
      '🔓  DEV BYPASS ACTIF : authentification Discord contournée (utilisateur factice, ' +
        'aucun rôle réellement attribué). Ne jamais activer en production.\n'
    );
  }
}

/**
 * Un utilisateur est-il administrateur du site ?
 * En dev bypass (local), l'utilisateur factice est considéré admin pour pouvoir
 * tester l'espace d'administration sans configuration Discord.
 */
function isAdmin(userId) {
  if (!userId) return false;
  if (config.devBypass && userId === 'dev-local-user') return true;
  return config.adminIds.includes(userId);
}

module.exports = { config, validateConfig, isAdmin };
