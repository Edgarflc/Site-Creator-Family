/**
 * Configuration du questionnaire "Creator Family".
 *
 * Le questionnaire est un GRAPHE (arbre) à embranchements :
 * - `startId` = identifiant de la PREMIÈRE question (toujours posée en premier).
 * - `finalId` = identifiant de la DERNIÈRE question (toujours posée en dernier,
 *   quel que soit le parcours). Dès qu'un chemin se termine (`next: null`),
 *   cette question finale est automatiquement ajoutée à la fin.
 * - `questions` = dictionnaire de questions indexées par leur id.
 * - Chaque réponse peut :
 *     • attribuer un ou plusieurs rôles via `roleIds`
 *     • mener à une question suivante via `next` (id d'une question),
 *       ou terminer le questionnaire si `next` vaut null.
 *
 * Ainsi, selon la réponse à la question centrale, l'utilisateur suit
 * un parcours différent. La première et la dernière question, elles,
 * sont fixes et posées à tous les visiteurs.
 *
 * Une question peut être à CHOIX MULTIPLE en ajoutant `multi: true` :
 * l'utilisateur sélectionne alors plusieurs réponses puis valide, et tous
 * les rôles correspondants sont attribués.
 *
 * IMPORTANT : le mapping réponse -> rôle (`roleIds`) reste côté serveur,
 * il n'est jamais envoyé au navigateur (voir routes/api.js).
 *
 * Champs d'une réponse :
 *   value      (string)  identifiant unique de la réponse dans sa question
 *   label      (string)  texte affiché
 *   emoji      (string)  optionnel, icône affichée
 *   note       (string)  optionnel, petit texte d'avertissement sous le label
 *   roleIds    (array)   ids des rôles à attribuer (peut être vide)
 *   next       (string)  id de la question suivante, ou null pour terminer
 *   locked     (bool)    optionnel : la réponse est affichée mais NON cliquable.
 *                        Le serveur n'attribue JAMAIS ses `roleIds` (sécurité).
 *                        Sert aux rôles prestigieux attribués manuellement.
 *   lockedNote (string)  optionnel : message expliquant comment obtenir ce rôle,
 *                        affiché sous la réponse verrouillée.
 */

const startId = 'arrivee';

// Question TOUJOURS posée en dernier, quel que soit le parcours emprunté.
const finalId = 'notifications';

// Rôle(s) attribué(s) à TOUT visiteur qui termine le questionnaire,
// c'est-à-dire dès qu'il valide la question finale (`finalId`),
// quel que soit le parcours emprunté.
const completionRoleIds = ['1514304635324858438'];

const questions = {
  // ---------- QUESTION CENTRALE ----------
  arrivee: {
    id: 'arrivee',
    question: "Bienvenue sur Creator Family ! Qu'est-ce qui t'amène parmi nous ?",
    description: 'Tu peux sélectionner plusieurs réponses.',
    multi: true,
    answers: [
      {
        value: 'createur',
        label: 'Je suis un créateur',
        icon: 'videocam',
        note: 'Tu produis déjà du contenu sur une ou plusieurs plateformes.',
        roleIds: [
          '1500509685940355162',
          '1500489390852542534',
          '1500489461958443189',
          '1500489592736845914',
        ],
        next: 'createur_abonnes',
      },
      {
        value: 'staff_createur',
        label: 'Je travaille pour des créateurs',
        icon: 'work',
        note: 'Manager, monteur, graphiste… tu es dans l\'équipe d\'un créateur.',
        roleIds: ['1500509981236007083'],
        next: 'staff_abonnes',
      },
      {
        value: 'futur_createur',
        label: "J'aimerais devenir un créateur",
        icon: 'rocket_launch',
        note: 'Tu n\'as pas encore commencé mais tu veux te lancer.',
        roleIds: [
          '1500509812453277807',
          '1500489390852542534',
          '1500489461958443189',
          '1500489592736845914',
        ],
        next: null,
      },
      {
        value: 'futur_staff',
        label: "J'aimerais travailler pour des créateurs",
        icon: 'group_add',
        note: 'Tu cherches à rejoindre l\'équipe d\'un créateur.',
        roleIds: ['1500509389134762174', '1514279436030181526'],
        next: 'staff_apprendre',
      },
      {
        value: 'partenaire',
        label: 'Je suis un Intervenant / Partenaire',
        icon: 'handshake',
        note: 'Ton identité sera vérifiée avant l\'attribution du rôle.',
        roleIds: ['1500512784922841279'],
        next: null,
      },
    ],
  },

  // ---------- SUITES DES PARCOURS ----------
  // Parcours "Je suis un créateur"
  createur_abonnes: {
    id: 'createur_abonnes',
    question: "Combien as-tu d'abonnés actuellement ?",
    description: '',
    answers: [
      {
        value: 'debutant',
        label: '0 à 10 000',
        icon: 'eco',
        note: 'Débutant',
        roleIds: ['1514279436030181526'],
        next: null,
      },
      {
        value: 'experimente',
        label: '10 000 à 100 000',
        icon: 'trending_up',
        note: 'Intermédiaire',
        roleIds: ['1514279651332063464'],
        next: null,
      },
      {
        value: 'professionnel',
        label: 'Plus de 100 000',
        icon: 'military_tech',
        note: 'Expérimenté',
        roleIds: ['1514279715924344833'],
        locked: true,
        lockedNote:
          'Rôle prestigieux : pour l\'obtenir, ouvre un ticket sur Discord et fais-toi vérifier par les admins.',
        next: null,
      },
    ],
  },

  // Ajoute ici les questions suivantes, puis renseigne le `next`
  // de la réponse correspondante ci-dessus. Exemple :
  //
  // createur_plateforme: {
  //   id: 'createur_plateforme',
  //   question: 'Sur quelle plateforme crées-tu principalement ?',
  //   answers: [
  //     { value: 'youtube', label: 'YouTube', emoji: '▶️', roleIds: ['ID'], next: null },
  //     { value: 'twitch',  label: 'Twitch',  emoji: '🟣', roleIds: ['ID'], next: null },
  //   ],
  // },

  // Parcours "Je travaille pour des créateurs"
  staff_abonnes: {
    id: 'staff_abonnes',
    question: "Combien d'abonnés ont les créateurs pour lesquels tu travailles ?",
    description: '',
    answers: [
      {
        value: 'debutant',
        label: '0 à 10 000',
        icon: 'eco',
        note: 'Débutant',
        roleIds: ['1514279436030181526'],
        next: 'staff_apprendre',
      },
      {
        value: 'experimente',
        label: '10 000 à 100 000',
        icon: 'trending_up',
        note: 'Intermédiaire',
        roleIds: ['1514279651332063464'],
        next: 'staff_apprendre',
      },
      {
        value: 'professionnel',
        label: 'Plus de 100 000',
        icon: 'military_tech',
        note: 'Expérimenté',
        roleIds: ['1514279715924344833'],
        locked: true,
        lockedNote:
          'Rôle prestigieux : pour l\'obtenir, ouvre un ticket sur Discord et fais-toi vérifier par les admins.',
        next: 'staff_apprendre',
      },
    ],
  },

  staff_apprendre: {
    id: 'staff_apprendre',
    question: "Qu'aimerais-tu apprendre en priorité sur ce serveur ?",
    description: "D'autres pôles ouvriront dans les prochaines semaines. Tu peux en sélectionner plusieurs.",
    multi: true,
    answers: [
      {
        value: 'ecriture_scenario',
        label: 'Écriture & Scénario',
        icon: 'edit_note',
        roleIds: ['1500489390852542534'],
        next: null,
      },
      {
        value: 'montage_video',
        label: 'Montage Vidéo',
        icon: 'movie',
        roleIds: ['1500489461958443189'],
        next: null,
      },
      {
        value: 'graphisme_miniature',
        label: 'Graphisme et Miniature',
        icon: 'palette',
        roleIds: ['1500489592736845914'],
        next: null,
      },
    ],
  },

  // ---------- QUESTION FINALE (toujours posée en dernier) ----------
  notifications: {
    id: 'notifications',
    question: 'Pour quelles informations souhaiterais-tu être notifié ?',
    description: 'Tu peux en sélectionner plusieurs (ou aucune).',
    multi: true,
    next: null,
    answers: [
      { value: 'annonces_majeures',     label: 'Annonces Majeures',            roleIds: ['1500494248674328777'] },
      { value: 'actualites_hub',        label: 'Actualités du Hub',            roleIds: ['1500494670575309047'] },
      { value: 'ping_conference',       label: 'Ping Conférence',              roleIds: ['1500494773486620713'] },
      { value: 'ping_masterclass',      label: 'Ping Masterclass',             roleIds: ['1500494824405729381'] },
      { value: 'ping_workshop',         label: 'Ping Workshop',                roleIds: ['1500494862477168720'] },
      { value: 'ping_events_irl',       label: 'Ping Events IRL',              roleIds: ['1500494902218195054'] },
      { value: 'alerte_missions',       label: 'Alerte Missions/Freelance',    roleIds: ['1500494970300272683'] },
      { value: 'alerte_recrutement',    label: 'Alerte Recrutement Staff',     roleIds: ['1500495062100869201'] },
      { value: 'alerte_collaborations', label: 'Alerte Collaborations créatives', roleIds: ['1500495128698290277'] },
      { value: 'alerte_partenariats',   label: 'Alerte Partenariats Marques',  roleIds: ['1500495189846917140'] },
    ],
  },
};

module.exports = { startId, finalId, completionRoleIds, questions };

