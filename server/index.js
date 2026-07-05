const path = require('path');
const express = require('express');
const session = require('express-session');
const { config, validateConfig, isAdmin } = require('./config');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const reminderScheduler = require('./services/reminderScheduler');

validateConfig();

const app = express();

// Derrière un reverse proxy (nginx sur le VPS OVH), pour que les cookies
// "secure" fonctionnent correctement en HTTPS.
app.set('trust proxy', 1);

app.use(express.json());

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

// Routes API / auth
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Page calendrier des conférences (réservée aux connectés).
// Si aucune session Discord n'est active, on redirige vers l'OAuth et on
// mémorise la destination pour y revenir après connexion.
app.get('/calendrier', (req, res) => {
  if (!req.session.user && !config.devBypass) {
    req.session.returnTo = '/calendrier';
    return res.redirect('/auth/login');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'calendrier.html'));
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
