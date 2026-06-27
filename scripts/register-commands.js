/**
 * Enregistre la (les) slash command(s) sur le serveur Discord.
 *
 * Usage :
 *   node scripts/register-commands.js
 *   npm run register-commands
 *
 * Les commandes de SERVEUR (guild) sont disponibles immédiatement (contrairement
 * aux commandes globales qui peuvent mettre jusqu'à 1 h à se propager).
 *
 * Prérequis : DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN et DISCORD_GUILD_ID dans .env
 */

const { config } = require('../server/config');

const DISCORD_API = 'https://discord.com/api/v10';

// Permission "Gérer les rôles" (Manage Roles) en bitfield.
// Seuls les membres possédant cette permission verront / pourront utiliser
// la commande. Mets '0' pour réserver aux admins uniquement, ou supprime le
// champ pour autoriser tout le monde.
const MANAGE_ROLES = '268435456';

// Type d'option ROLE dans l'API Discord.
const OPTION_TYPE_ROLE = 8;

const commands = [
  {
    name: 'roleall',
    description: 'Attribue un rôle à TOUS les membres du serveur',
    default_member_permissions: MANAGE_ROLES,
    // La commande n'a de sens que dans un serveur.
    dm_permission: false,
    options: [
      {
        type: OPTION_TYPE_ROLE,
        name: 'role',
        description: 'Le rôle à attribuer à tout le monde',
        required: true,
      },
    ],
  },
];

async function main() {
  const { clientId, botToken, guildId } = config.discord;
  if (!clientId || !botToken || !guildId) {
    console.error(
      '❌ DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN et DISCORD_GUILD_ID doivent être renseignés dans .env'
    );
    process.exit(1);
  }

  const url = `${DISCORD_API}/applications/${clientId}/guilds/${guildId}/commands`;
  const res = await fetch(url, {
    method: 'PUT', // PUT remplace l'ensemble des commandes du serveur
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ Échec de l'enregistrement (${res.status}) : ${text}`);
    process.exit(1);
  }

  const registered = JSON.parse(text);
  console.log('✅ Commande(s) enregistrée(s) sur le serveur :');
  for (const c of registered) {
    console.log(`   • /${c.name} — ${c.description}`);
  }
}

main().catch((err) => {
  console.error('💥 Erreur :', err.message);
  process.exit(1);
});
