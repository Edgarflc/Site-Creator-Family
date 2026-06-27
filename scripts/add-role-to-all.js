/**
 * Commande : attribue un rôle à TOUS les membres du serveur Discord.
 *
 * Usage :
 *   node scripts/add-role-to-all.js <ROLE_ID> [--include-bots] [--dry-run]
 *   npm run add-role -- <ROLE_ID> [--include-bots] [--dry-run]
 *
 * Options :
 *   --include-bots  attribue aussi le rôle aux comptes bots (ignorés par défaut)
 *   --dry-run       n'attribue rien, affiche seulement ce qui serait fait
 *
 * Prérequis :
 *   - Les variables d'environnement Discord doivent être renseignées (.env) :
 *       DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
 *   - Le bot doit avoir la permission "Gérer les rôles" ET son rôle doit être
 *     positionné AU-DESSUS du rôle à attribuer dans la hiérarchie du serveur.
 *   - L'intent privilégié "SERVER MEMBERS INTENT" doit être ACTIVÉ pour le bot
 *     dans le Developer Portal (onglet Bot), sans quoi la liste des membres
 *     ne peut pas être récupérée.
 */

const { config } = require('../server/config');
const { addRoleToMember } = require('../server/services/discord');

const DISCORD_API = 'https://discord.com/api/v10';

/**
 * Récupère TOUS les membres du serveur, page par page (pagination `after`).
 * Gère le rate limit (429) en respectant le délai demandé par Discord.
 * @returns {Promise<Array>} liste des objets membre Discord
 */
async function fetchAllMembers() {
  const members = [];
  let after = '0';

  // L'API renvoie au maximum 1000 membres par page.
  // On continue tant qu'une page pleine est renvoyée.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url =
      `${DISCORD_API}/guilds/${config.discord.guildId}/members` +
      `?limit=1000&after=${after}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bot ${config.discord.botToken}` },
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const waitMs = Math.ceil((data.retry_after ?? 1) * 1000) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 403) {
        throw new Error(
          "Accès refusé à la liste des membres (403). Active l'intent " +
            '"SERVER MEMBERS INTENT" pour le bot dans le Developer Portal, ' +
            'et vérifie ses permissions.'
        );
      }
      throw new Error(`Impossible de récupérer les membres (${res.status}): ${text}`);
    }

    const page = await res.json();
    members.push(...page);

    if (page.length < 1000) break; // dernière page atteinte
    after = page[page.length - 1].user.id; // curseur = dernier id de la page
  }

  return members;
}

async function main() {
  const args = process.argv.slice(2);
  const roleId = args.find((a) => !a.startsWith('--'));
  const includeBots = args.includes('--include-bots');
  const dryRun = args.includes('--dry-run');

  if (!roleId || !/^\d{5,25}$/.test(roleId)) {
    console.error(
      '❌ Usage : node scripts/add-role-to-all.js <ROLE_ID> [--include-bots] [--dry-run]\n' +
        '   ROLE_ID doit être l\'identifiant numérique du rôle Discord.'
    );
    process.exit(1);
  }

  if (!config.discord.botToken || !config.discord.guildId) {
    console.error(
      '❌ DISCORD_BOT_TOKEN et DISCORD_GUILD_ID doivent être renseignés dans .env'
    );
    process.exit(1);
  }

  console.log(`📥 Récupération des membres du serveur ${config.discord.guildId}...`);
  const allMembers = await fetchAllMembers();

  const targets = allMembers.filter((m) => includeBots || !m.user.bot);
  const skippedBots = allMembers.length - targets.length;

  console.log(
    `👥 ${allMembers.length} membre(s) trouvé(s)` +
      (skippedBots ? ` (${skippedBots} bot(s) ignoré(s))` : '') +
      `\n🎯 Rôle à attribuer : ${roleId}` +
      (dryRun ? '\n🧪 Mode DRY-RUN : aucune modification ne sera appliquée.' : '') +
      '\n'
  );

  let success = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const member = targets[i];
    const tag = member.user.username;
    const progress = `[${i + 1}/${targets.length}]`;

    if (dryRun) {
      console.log(`${progress} (dry-run) ${tag} (${member.user.id})`);
      continue;
    }

    try {
      await addRoleToMember(member.user.id, roleId);
      success++;
      console.log(`${progress} ✅ ${tag}`);
    } catch (err) {
      failed++;
      console.error(`${progress} ❌ ${tag} — ${err.message}`);
    }

    // Petite pause entre chaque requête pour limiter le rate limit Discord.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  console.log(
    `\n✨ Terminé. ${dryRun ? targets.length + ' membre(s) (dry-run)' : `${success} réussite(s), ${failed} échec(s)`}.`
  );
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale :', err.message);
  process.exit(1);
});
