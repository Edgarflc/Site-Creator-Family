// Les conférences sont saisies en heure locale française (ex. '2026-07-12T18:00:00',
// sans fuseau). Sur un hébergeur en UTC (Railway), ces dates seraient interprétées
// à côté (décalage de 1 à 2 h), ce qui déclenchait les rappels à la mauvaise heure.
// On force donc tout le process sur Europe/Paris (l'heure d'été est gérée par l'OS).
process.env.TZ = process.env.TZ || 'Europe/Paris';

const path = require('path');
const express = require('express');
const session = require('express-session');
const { config, validateConfig, isAdmin } = require('./config');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const honeypotRoutes = require('./routes/honeypot');
const reminderScheduler = require('./services/reminderScheduler');

validateConfig();

const app = express();

// Derrière un reverse proxy (nginx sur le VPS OVH), pour que les cookies
// "secure" fonctionnent correctement en HTTPS.
app.set('trust proxy', 1);

// En-têtes de sécurité (clickjacking, sniffing MIME, fuite de referrer, CSP).
// Le site ne charge que : ses propres fichiers, les Google Fonts (feuille de
// style + polices) et les avatars Discord (images). Aucun script/style inline
// (vérifié), donc un CSP strict ne casse rien.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://cdn.discordapp.com data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
const isHttps = config.baseUrl.startsWith('https://');
app.use((req, res, next) => {
  res.set('Content-Security-Policy', CSP);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HSTS seulement en prod (HTTPS) : inutile — voire gênant — en local http.
  if (isHttps) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());
// Nécessaire au honeypot pour lire le formulaire (faux) de connexion WordPress.
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: 'cf.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Activé automatiquement en prod (HTTPS). En local (http) on le laisse à false.
      secure: config.baseUrl.startsWith('https://'),
      maxAge: 1000 * 60 * 60 * 24, // 24h
    },
  })
);

// Honeypot Mellisec : intercepte les chemins WordPress sondés par les bots
// (fausses pages + signalement au dashboard). Monté tôt, avant les fichiers
// statiques, pour capter /wp-login.php, /xmlrpc.php, /wp-admin, etc.
app.use(honeypotRoutes);

// Routes API / auth
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Page des conférences (calendrier + rediffusions), réservée aux connectés.
// Si aucune session Discord n'est active, on redirige vers l'OAuth et on
// mémorise la destination pour y revenir après connexion.
app.get('/conferences', (req, res) => {
  if (!req.session.user && !config.devBypass) {
    req.session.returnTo = req.originalUrl; // conserve un éventuel ?feedback=...
    return res.redirect('/auth/login');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'conferences.html'));
});

// Ancienne URL `/calendrier` : redirection permanente vers `/conferences`
// (en conservant la query, ex : les liens d'avis ?feedback=...).
app.get('/calendrier', (req, res) => {
  res.redirect(301, req.originalUrl.replace('/calendrier', '/conferences'));
});

// Espace d'administration (réservé aux admins). Redirige vers la connexion si
// nécessaire, ou vers l'accueil si l'utilisateur n'est pas administrateur.
app.get('/admin', (req, res) => {
  if (!req.session.user && !config.devBypass) {
    req.session.returnTo = '/admin';
    return res.redirect('/auth/login');
  }
  if (req.session.user && !isAdmin(req.session.user.id)) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`\n✅ Creator Family en ligne sur ${config.baseUrl}`);
  console.log(`   (port ${config.port})\n`);

  // Lance les rappels de conférences (MP 30 min avant le début).
  reminderScheduler.start();
});
