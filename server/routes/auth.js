const express = require('express');
const crypto = require('crypto');
const { config } = require('../config');
const { exchangeCode, fetchCurrentUser } = require('../services/discord');

const router = express.Router();

const OAUTH_SCOPE = 'identify';

/**
 * GET /auth/login
 * Redirige l'utilisateur vers la page d'autorisation Discord.
 * Un "state" aléatoire est stocké en session pour se protéger du CSRF.
 */
router.get('/login', (req, res) => {
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

    res.redirect('/');
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
  res.json({ user: req.session.user || null });
});

/**
 * POST /auth/logout
 * Déconnecte l'utilisateur.
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
