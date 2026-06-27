const { config } = require('../config');

const DISCORD_API = 'https://discord.com/api/v10';

/**
 * Échange le code OAuth2 reçu dans le callback contre un access token.
 * @param {string} code - code d'autorisation renvoyé par Discord
 * @returns {Promise<object>} la réponse token de Discord
 */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.discord.redirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échec de l'échange du code OAuth2 (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Récupère le profil de l'utilisateur connecté via son access token.
 * @param {string} accessToken
 * @returns {Promise<object>} { id, username, avatar, ... }
 */
async function fetchCurrentUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Impossible de récupérer l'utilisateur (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Attribue un rôle à un membre du serveur via le bot.
 * Nécessite que le bot ait la permission "Gérer les rôles" et que son rôle
 * soit positionné AU-DESSUS des rôles à attribuer dans la hiérarchie.
 *
 * Gère automatiquement le rate limit (429) : si Discord renvoie un délai
 * `retry_after`, on attend ce délai puis on réessaie (jusqu'à 5 tentatives).
 *
 * @param {string} userId - ID Discord du membre
 * @param {string} roleId - ID du rôle à attribuer
 * @param {number} attempt - compteur interne de tentatives (rate limit)
 */
async function addRoleToMember(userId, roleId, attempt = 0) {
  const url = `${DISCORD_API}/guilds/${config.discord.guildId}/members/${userId}/roles/${roleId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${config.discord.botToken}`,
      'Content-Type': 'application/json',
    },
  });

  // 204 = succès (rôle ajouté ou déjà présent)
  if (res.status === 204) return true;

  // 429 = rate limit : on attend le délai demandé par Discord puis on réessaie.
  if (res.status === 429 && attempt < 5) {
    const data = await res.json().catch(() => ({}));
    const waitMs = Math.ceil((data.retry_after ?? 1) * 1000) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return addRoleToMember(userId, roleId, attempt + 1);
  }

  const text = await res.text();

  if (res.status === 404) {
    throw new Error(
      "Membre introuvable sur le serveur. L'utilisateur doit avoir rejoint le serveur Discord."
    );
  }
  if (res.status === 403) {
    throw new Error(
      "Permission refusée. Vérifie que le bot a 'Gérer les rôles' et que son rôle est au-dessus du rôle à attribuer."
    );
  }
  throw new Error(`Échec de l'attribution du rôle (${res.status}): ${text}`);
}

module.exports = { exchangeCode, fetchCurrentUser, addRoleToMember };
