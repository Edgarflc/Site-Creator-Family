const express = require('express');
const crypto = require('crypto');
const { config, isAdmin } = require('../config');
const { exchangeCode, fetchCurrentUser } = require('../services/discord');
const { hasCompleted } = require('../services/store');
const { createRateLimiter } = require('../services/rateLimit');

const router = express.Router();

const OAUTH_SCOPE = 'identify';

// Limite les démarrages de connexion OAuth par IP (anti-automatisation/abus).
const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Trop de tentatives de connexion. Patiente quelques minutes.',
});

/**
 * GET /auth/login
 * Redirige l'utilisateur vers la page d'autorisation Discord.
 * Un "state" aléatoire est stocké en session pour se protéger du CSRF.
 */
router.get('/login', loginLimiter, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    state,
    prompt: 'consent',
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

/**
 * GET /auth/callback
 * Callback OAuth2 : échange le code, récupère l'utilisateur et l'enregistre en session.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/?auth=denied');
  }
  if (!code || !state || state !== req.session.oauthState) {
    return res.redirect('/?auth=invalid');
  }
  delete req.session.oauthState;

  try {
    const token = await exchangeCode(code);
    const user = await fetchCurrentUser(token.access_token);

    req.session.user = {
      id: user.id,
      username: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
    };

    // Revient sur la page d'origine (ex : /conferences) si elle a été mémorisée,
    // sinon retour à l'accueil.
    const dest = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(dest);
  } catch (err) {
    console.error('[auth/callback]', err.message);
    res.redirect('/?auth=error');
  }
});

/**
 * GET /auth/me
 * Renvoie l'utilisateur connecté (ou null).
 */
router.get('/me', (req, res) => {
  // Bypass dev : on ouvre une session factice pour accéder au site en local
  // sans passer par l'OAuth Discord.
  if (config.devBypass && !req.session.user) {
    req.session.user = {
      id: 'dev-local-user',
      username: 'Dev Local',
      avatar: null,
    };
  }
  const user = req.session.user || null;
  // `completed` indique si l'utilisateur a déjà terminé le questionnaire au
  // moins une fois : le front affiche alors l'accueil plutôt que le questionnaire.
  res.json({
    user,
    completed: user ? hasCompleted(user.id) : false,
    isAdmin: user ? isAdmin(user.id) : false,
  });
});

/**
 * POST /auth/logout
 * Déconnecte l'utilisateur.
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
