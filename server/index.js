const path = require('path');
const express = require('express');
const session = require('express-session');
const { config, validateConfig } = require('./config');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

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

// Fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`\n✅ Creator Family en ligne sur ${config.baseUrl}`);
  console.log(`   (port ${config.port})\n`);
});
