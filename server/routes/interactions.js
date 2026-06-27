const crypto = require('crypto');
const express = require('express');
const { config } = require('../config');
const { addRoleToMember, fetchAllMembers } = require('../services/discord');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';

// Types d'interactions et de réponses (constantes de l'API Discord).
const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 };
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
};
const EPHEMERAL = 1 << 6; // flag "message visible uniquement par l'auteur"

/**
 * Vérifie la signature Ed25519 d'une requête d'interaction Discord.
 * Discord signe (timestamp + corps brut) avec sa clé privée ; on vérifie
 * avec la clé publique de l'application. Utilise le module crypto natif
 * (Node 18+), sans dépendance externe.
 *
 * @param {Buffer} rawBody - corps brut EXACT de la requête
 * @param {string} signature - en-tête X-Signature-Ed25519 (hex)
 * @param {string} timestamp - en-tête X-Signature-Timestamp
 * @returns {boolean}
 */
function verifySignature(rawBody, signature, timestamp) {
  if (!signature || !timestamp || !config.discord.publicKey) return false;
  try {
    const message = Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]);
    const sig = Buffer.from(signature, 'hex');
    const pub = Buffer.from(config.discord.publicKey, 'hex');
    // Encapsule la clé publique brute (32 octets) dans une structure DER SPKI
    // pour que crypto.createPublicKey l'accepte comme clé Ed25519.
    const der = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      pub,
    ]);
    const keyObject = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    return crypto.verify(null, message, keyObject, sig);
  } catch {
    return false;
  }
}

/**
 * Édite la réponse différée d'une interaction (via le webhook d'interaction).
 * @param {string} token - token de l'interaction
 * @param {string} content - nouveau contenu du message
 */
async function editOriginalResponse(token, content) {
  await fetch(
    `${DISCORD_API}/webhooks/${config.discord.clientId}/${token}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  );
}

/**
 * Tâche de fond : attribue `roleId` à tous les membres du serveur,
 * puis met à jour le message d'interaction avec le récapitulatif.
 */
async function assignRoleToEveryone(roleId, token) {
  try {
    const members = await fetchAllMembers();
    const targets = members.filter((m) => !m.user.bot);

    let success = 0;
    let failed = 0;
    for (const member of targets) {
      try {
        await addRoleToMember(member.user.id, roleId);
        success++;
      } catch {
        failed++;
      }
      // Pause anti rate-limit entre chaque attribution.
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await editOriginalResponse(
      token,
      `✅ Rôle <@&${roleId}> attribué.\n` +
        `• Réussites : **${success}**\n` +
        `• Échecs : **${failed}**\n` +
        `• Membres traités : **${targets.length}** (bots ignorés)`
    );
  } catch (err) {
    await editOriginalResponse(token, `❌ Échec : ${err.message}`);
  }
}

/**
 * POST /interactions
 * Endpoint appelé par Discord pour toutes les interactions (slash commands).
 * À configurer dans le Developer Portal :
 *   "Interactions Endpoint URL" = https://TON-DOMAINE/interactions
 */
router.post('/', (req, res) => {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');

  // req.rawBody est rempli par le middleware express.json (voir index.js).
  if (!verifySignature(req.rawBody, signature, timestamp)) {
    return res.status(401).send('invalid request signature');
  }

  const interaction = req.body;

  // 1) PING de vérification envoyé par Discord lors de la configuration.
  if (interaction.type === InteractionType.PING) {
    return res.json({ type: InteractionResponseType.PONG });
  }

  // 2) Slash commands.
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data?.name;

    if (name === 'roleall') {
      const roleOption = (interaction.data.options || []).find((o) => o.name === 'role');
      const roleId = roleOption?.value;

      if (!roleId) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: EPHEMERAL, content: '❌ Rôle manquant.' },
        });
      }

      // Réponse différée (l'opération peut dépasser 3 s) : on confirme la
      // réception immédiatement, puis on traite en arrière-plan.
      res.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: EPHEMERAL },
      });

      // Lance le traitement sans bloquer la réponse HTTP.
      assignRoleToEveryone(roleId, interaction.token);
      return;
    }

    // Commande inconnue.
    return res.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: EPHEMERAL, content: 'Commande inconnue.' },
    });
  }

  // Type non géré.
  res.status(400).send('unhandled interaction type');
});

module.exports = router;
