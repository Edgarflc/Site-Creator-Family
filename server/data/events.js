/**
 * Configuration des conférences / événements à venir de la Creator Family.
 *
 * Ce fichier s'édite à la main, comme `questions.js`. Chaque entrée décrit une
 * conférence affichée dans le calendrier (page `/conferences`, réservée aux
 * utilisateurs connectés via Discord).
 *
 * Champs d'une conférence :
 *   id          (string)  identifiant unique (utile comme clé, pas affiché)
 *   title       (string)  titre de la conférence
 *   start       (string)  date + heure au format ISO 8601 LOCAL, ex :
 *                          '2026-07-12T18:00:00'. Le fuseau est celui du serveur ;
 *                          l'affichage est formaté en français côté navigateur.
 *   host        (string)  intervenant / hôte de la conférence
 *   description (string)  court texte décrivant la conférence
 *   replayUrl   (string)  lien de rediffusion (optionnel ; affiché dans l'onglet
 *                          « Rediffusions » une fois la conférence passée)
 *
 * Les conférences PASSÉES sont retirées du calendrier « à venir » (voir
 * routes/api.js) et basculent dans l'onglet « Rediffusions ».
 * L'ordre du tableau n'a pas d'importance : le tri se fait par date à la volée.
 */

const events = [
  {
    id: 'conf-ia-createurs',
    title: "L'IA au service des créateurs",
    start: '2026-07-12T18:00:00',
    host: 'Alex Dupont',
    description:
      "Panorama des outils IA pour automatiser ta production de contenu, du script au montage.",
  },
  {
    id: 'conf-monetisation',
    title: 'Monétiser sa communauté',
    start: '2026-07-19T20:30:00',
    host: 'Camille Rivet',
    description:
      "Abonnements, sponsors, produits dérivés : construire des revenus durables sans trahir ton audience.",
  },
  {
    id: 'conf-montage-express',
    title: 'Montage express : gagner 10h par semaine',
    start: '2026-08-02T19:00:00',
    host: 'Yanis Bakri',
    description:
      "Workflow, raccourcis et templates pour monter plus vite sans sacrifier la qualité.",
  },
  {
    id: 'conf-algo-2026',
    title: 'Comprendre les algorithmes en 2026',
    start: '2026-08-16T18:30:00',
    host: 'Sarah Nguyen',
    description:
      "Ce que YouTube, TikTok et Instagram récompensent vraiment cette année, et comment t'y adapter.",
  },
];

module.exports = { events };
