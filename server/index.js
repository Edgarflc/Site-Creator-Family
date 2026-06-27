const path = require('path');
const express = require('express');
const session = require('express-session');
const { config, validateConfig } = require('./config');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const interactionsRoutes = require('./routes/interactions');

validateConfig();

const app = express();

// Derrière un reverse proxy (nginx sur le VPS OVH), pour que les cookies
// "secure" fonctionnent correctement en HTTPS.
app.set('trust proxy', 1);

// On conserve le corps brut de la requête (req.rawBody) : il est indispensable
// pour vérifier la signature Ed25519 des interactions Discord (/interactions),
// qui porte sur les octets exacts reçus.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

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
// Endpoint des interactions Discord (slash commands)
app.use('/interactions', interactionsRoutes);

// Fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`\n✅ Creator Family en ligne sur ${config.baseUrl}`);
  console.log(`   (port ${config.port})\n`);
});
