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

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: resolveBaseUrl(),
  sessionSecret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    botToken: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    // Clé publique de l'application (onglet "General Information" du portail).
    // Sert à vérifier la signature des interactions (slash commands) envoyées
    // par Discord sur l'endpoint HTTP /interactions.
    publicKey: process.env.DISCORD_PUBLIC_KEY,
  },
};

config.discord.redirectUri = `${config.baseUrl}/auth/callback`;

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
}

module.exports = { config, validateConfig };
